# Running Stack Infrastructure (`infra/stack/`)

This directory contains the ephemeral runtime infrastructure for BlunderLive. It can be applied when needed and destroyed when idle to minimize costs.

## Resources Provisioned
- **VPC & Subnets**: 2 Public Subnets (ALB, ECS Fargate tasks with public IPs), 2 Isolated Subnets (RDS, Redis). **Zero NAT Gateways** to minimize cost.
- **RDS Postgres**: Single-AZ `db.t4g.micro` (credit-billed ARM; no legacy free tier on this account). `skip_final_snapshot = true` and `deletion_protection = false` for zero-cost destroys.
- **ElastiCache Redis**: Single-node `cache.t4g.micro` (Redis 7.1).
- **Application Load Balancer (ALB)**:
  - `/ws/*` $\rightarrow$ `game` service (with long timeout for WebSockets)
  - `/api/game/*` $\rightarrow$ `game` service
  - `/api/*` $\rightarrow$ `core` service
  - `/*` $\rightarrow$ `frontend` service
- **ECS Service Connect**: Internal DNS namespace (`blunderlive.local`) enabling seamless service discovery for `frontend` $\rightarrow$ `core`/`game` and `game` $\rightarrow$ `core`.
- **5 ECS Fargate Services**: `frontend`, `core`, `core-worker`, `game`, `game-worker` (all 0.25 vCPU, 0.5 GB).

## Prerequisites Before First Apply
1. `infra/persistent/` applied (S3 state bucket, DynamoDB lock table, ECR repositories created).
2. Docker images built and pushed to ECR (or via GitHub Actions CI/CD).
3. Secret values populated in AWS SSM Parameter Store under `/${PROJECT_NAME}/production/*`.

## How to Operate

### 1. Launching the stack
```bash
cd infra/stack
terraform init
terraform plan
terraform apply
```

### 2. First-time database migrations (bootstrap)

Migrations are **not** part of the core container's start command — they run as a one-off ECS task from CI on every deploy (see `.github/workflows/deploy.yml`). On the very **first** `terraform apply` the CI deploy job skips (`ECS Cluster ... is not currently active`), so `core` starts with an empty schema and nothing migrates it. Run them once manually before testing the site:

```bash
cd infra/stack
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
SUBNETS=$(terraform output -json ecs_subnet_ids | jq -r 'join(",")')
SECURITY_GROUPS=$(terraform output -raw ecs_security_group_id)

aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition blunderlive-core \
  --launch-type FARGATE \
  --count 1 \
  --overrides '{"containerOverrides":[{"name":"core","command":["python","manage.py","migrate","--noinput"]}]}' \
  --network-configuration "awsvpcConfiguration={subnets=$SUBNETS,securityGroups=$SECURITY_GROUPS,assignPublicIp=ENABLED}"
```

`--task-definition blunderlive-core` resolves to the latest revision Terraform registered (the `latest` image tag). Note the command override — without it the task would run the container's default start command (collectstatic + gunicorn) and never stop. If you want a specific build instead of `latest`, add `"image":"${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/blunderlive-core:sha-<sha>"` to the `containerOverrides` entry.

The `run-task` output prints the task ARN; poll it and confirm `exitCode == 0` before testing the site:

```bash
TASK_ARN="arn:aws:ecs:...:task/blunderlive-cluster/...\"  # substitute from run-task output
aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" --query "tasks[0].lastStatus"
aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" --query "tasks[0].containers[0].exitCode"
```

Wait until `lastStatus` is `STOPPED`; a non-zero `exitCode` means migrations failed and the site should not be tested yet.

### 3. Destroying the stack (stops all hourly billing)
```bash
cd infra/stack
terraform destroy
```

## Known trade-offs

- **CI/Terraform task-definition drift**: the deploy workflow re-registers task definition revisions with only the container image changed, independent of Terraform (`.github/workflows/deploy.yml`). If `infra/stack/ecs_services.tf` is edited to change environment variables, secrets, or other container config, those changes will **not** reach running services until the next `terraform apply` — a CI deploy in between runs on the stale env/secrets config with a newer image. Accepted at this project's scale; do not regenerate container definitions from Terraform in CI.
