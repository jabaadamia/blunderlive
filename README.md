# BlunderLive

BlunderLive is a real-time chess platform: register, get matched into a rated game against another player, and play it out over WebSocket with server-validated moves and clocks. There's also an in-browser Stockfish analysis feature for reviewing games afterward.

The repo is one monorepo split into three services and two data stores:

| Service | Role |
| --- | --- |
| `frontend` | Next.js - UI, auth, in-browser Stockfish (WASM) analysis |
| `services/core` | Django + DRF - accounts, JWT auth, game records, ratings |
| `services/game` | FastAPI - matchmaking queue, live WebSocket gameplay |
| `postgres` / `redis` | Persistent storage, plus a Redis-stream pipeline that hands finished games from `game` to `core` |

Locally, `nginx` sits in front of everything as the reverse proxy; the hosted deployment uses an AWS ALB in its place.

## Features

- JWT auth with refresh-token rotation
- Matchmaking queue that pairs waiting players into a live game
- Server-validated moves, clocks, and disconnect handling over WebSocket
- Finished games flow through Redis streams to async workers that update ratings
- In-browser Stockfish analysis - spot blunders and review the game afterward

## Environments

Compose config is split by environment:

- `compose.yaml` - shared service definitions, production-safe defaults
- `compose.override.dev.yaml` - bind mounts, dev servers, host-exposed ports
- `compose.override.prod.yaml` - production runtime targets

`make` targets take `ENV=dev` or `ENV=prod`.

## First-time setup

```bash
make init
```

Fill in `.env` (local defaults work as-is). For anything resembling production, set at minimum `CORE_SECRET_KEY`, `CORE_DEBUG=False`, and the real host/origin variables.

`make init` also generates a local development JWT keypair under `infra/dev-jwt/` if one doesn't already exist.

## Running it

**Dev** - live-reload containers for Django, FastAPI, and Next.js, still routed through nginx so the browser sees the same reverse-proxy shape as production:

```bash
make up-dev
```

Open [http://localhost:8080](http://localhost:8080). Direct debug ports: frontend `:3000`, core `http://localhost:8000/health/`, game `http://localhost:8005/health`.

**Production-like** - applies Django migrations and `collectstatic` before starting the stack; nginx serves Django's static files from a shared volume and the frontend runs a standalone build:

```bash
make up-prod
```

Review `.env` for production values first. Open [http://localhost:8080](http://localhost:8080).

## Deploying to AWS

- `infra/persistent/` - one-time provisioning: S3 state bucket, ECR repos, GitHub Actions OIDC role, SSM secret skeletons, billing alarms.
- `infra/stack/` - the deployable runtime: VPC, ALB, RDS, Redis, Cloud Map DNS, 5 Fargate services.
- `.github/workflows/deploy.yml` - builds images, runs migrations, and updates services on every push to `main`.

First deploy: apply `infra/persistent/`, then `cd infra/stack && terraform apply`, then push. The very first apply has no CI migration step to run yet, so the database needs a manual one-off bootstrap - see `infra/stack/README.md`. Everything after that is just pushing to `main`.

## Commands

- `make build-dev` / `make build-prod`
- `make up-dev` / `make up-prod`, `make down-dev` / `make down-prod`
- `make logs ENV=dev` / `make logs ENV=prod`, `make ps ENV=prod`
- `make bootstrap ENV=prod`
- `make migrate-core ENV=prod`, `make collectstatic-core ENV=prod`
- `make test-core`, `make test-game`, `make test-frontend`
- `make lint-frontend`

## Notes

- Always go through nginx, in both environments - the frontend relies on same-origin `/api` and `/api/game` requests.
- Postgres and Redis are only exposed to the host in dev.
- `infra/dev-jwt/` holds dev/CI-only key material generated locally - never use it in production.
- Production should mount externally managed JWT keys instead, via `CORE_JWT_PRIVATE_KEY_PATH`, `CORE_JWT_PUBLIC_KEY_PATH`, and `GAME_JWT_PUBLIC_KEY_PATH` (the last pointing at the same public key core uses).