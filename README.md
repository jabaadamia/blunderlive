# BlunderLive

Minimal production-minded starting point for the chess game service.

## Current scope

- FastAPI service in `services/game`
- Redis for local infrastructure
- Docker Compose for local development
- GitHub Actions for CI and container publishing

## Local setup

1. Copy `.env.example` to `.env`
2. Run `make build`
3. Run `make up`
4. Open `http://localhost:8005/health`

## VS Code devcontainer

1. Open the repo root in VS Code
2. Run `Dev Containers: Reopen in Container`
3. Wait for the container build and dependency install to finish
4. Use the integrated terminal inside the container from `/workspaces/blunderlive/services/game`

The devcontainer uses the existing `game` and `redis` services, mounts the full repo into the container, and keeps Git available inside the container.

## Useful commands

- `make init`
- `make build`
- `make up`
- `make logs`
- `make ps`
- `make lint`
- `make test`

## Next steps

- Add config validation for future auth and matchmaking settings
- Add Redis-backed repository layer
- Add WebSocket skeleton
- Add matchmaking and game domain logic
