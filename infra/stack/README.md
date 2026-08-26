# Runtime Stack (`infra/stack/`)

Ephemeral AWS infrastructure for the hosted BlunderLive deployment. Nothing here bills by the hour once it's gone.

## What it provisions

- **VPC & subnets** — 2 public subnets (ALB, Fargate tasks with public IPs), 2 isolated subnets (RDS, Redis). No NAT gateway, so no NAT cost.
- **RDS PostgreSQL** — single-AZ `db.t4g.micro`, `skip_final_snapshot = true`, `deletion_protection = false`, so destroys are clean and free.
- **ElastiCache Redis** — single-node `cache.t4g.micro` (Redis 7.1).
- **Application Load Balancer**, routed by path:

  | Path | Target |
  | --- | --- |
  | `/ws`, `/ws/*` | `game` (kept for WebSocket upgrades; unused by the current frontend) |
  | `/api/game/*` | `game` - REST and WebSocket, e.g. `/api/game/games/{id}/ws` |
  | `/api/*` | `core` |
  | `/*` | `frontend` |

  The ALB can't rewrite paths, so frontend and server routes are kept aligned instead.
- **Cloud Map service discovery** — private namespace `blunderlive.local`, with A-records re-registered automatically as tasks start and stop. Services find each other as `core.blunderlive.local:8000` and `game.blunderlive.local:8005`.
- **5 Fargate services** (0.25 vCPU / 0.5 GB each): `frontend`, `core`, `core-worker`, `game`, `game-worker`.

## Prerequisites

1. `infra/persistent/` already applied (S3 state bucket, ECR repos, OIDC deploy role, SSM secret skeletons)
2. Images built and pushed to ECR (locally or via the GitHub Actions workflow)
3. Secrets populated in SSM Parameter Store under `/${PROJECT_NAME}/production/*`

## First apply

```bash
cd infra/stack
terraform init
terraform apply
terraform output alb_dns_name
```

## Bootstrapping the database (first apply only)

Migrations aren't part of the core container's start command - CI runs them as a one-off ECS task on every deploy (`.github/workflows/deploy.yml`). On the very first `terraform apply` the cluster isn't active yet, so CI's deploy job skips, and `core` comes up with an empty schema. Run migrations once by hand:

```bash
cd infra/stack
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)

NETWORK_CONFIG=$(jq -n \
  --argjson subnets "$(terraform output -json ecs_subnet_ids)" \
  --arg group "$(terraform output -raw ecs_security_group_id)" \
  '{awsvpcConfiguration:{subnets:$subnets,securityGroups:[$group],assignPublicIp:"ENABLED"}}')

aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition blunderlive-core \
  --launch-type FARGATE \
  --count 1 \
  --network-configuration "$NETWORK_CONFIG" \
  --overrides '{"containerOverrides":[{"name":"core","command":["python","manage.py","migrate","--noinput"]}]}'
```

Use the JSON `--network-configuration` form above - the `awsvpcConfiguration={subnets=...,...}` shorthand breaks once subnets are comma-joined.

`--task-definition blunderlive-core` resolves to whatever revision Terraform just registered (the `latest` tag). The command override matters: without it the task runs the container's default command (collectstatic + gunicorn) and never exits. To pin a specific build instead of `latest`, add `"image":"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/blunderlive-core:sha-<sha>"` to the override.

Poll until the task stops, then check its exit code — `0` means the schema's ready, anything else means migrations failed and the site isn't ready to test:

```bash
TASK_ARN="arn:aws:ecs:us-east-1:...:task/<cluster>/<id>"   # from run-task output
aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" \
  --query "tasks[0].containers[0].exitCode"
```

## Later deploys

Push to `main` (or an empty commit). The workflow rebuilds images, runs the migrate one-off, and updates each service — no manual steps.

## Destroy (stops hourly billing)

```bash
cd infra/stack
terraform destroy
```

State lives in the S3 bucket owned by `infra/persistent/`, so re-applying later is safe. The database comes back empty - repeat the bootstrap step, then let the next CI deploy migrate and update services to pinned images.

## Verifying a deploy

- Open `terraform output alb_dns_name` and register a user (the ALB endpoint works over plain HTTP).
- Matchmaking: the game service should log a `200` for the WebSocket after pairing - a `403` means the connection got closed before accept, usually a client/server WS path mismatch.
- Stockfish: `GET /stockfish/...js` on the frontend should return `200`.

## Known trade-offs

- **CI/Terraform task-definition drift** - the deploy workflow re-registers task definitions with only the container image changed, independent of Terraform. Edit environment variables, secrets, or container config in `infra/stack/ecs_services.tf`, and those changes won't reach running services until the next `terraform apply` - a CI deploy in between would run a newer image against the stale env/secrets config. Fine at this project's scale; don't try to regenerate container definitions from Terraform in CI.
- **HTTP only** - the hosted stack serves plain HTTP, no HTTPS listener or certificate. Refresh cookies are set non-secure to match. Add a certificate (and flip the cookie `Secure` flags) before going to HTTPS.