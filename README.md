# BlunderLive

Minimal production-minded starting point for the chess platform backend.

## Services

- `frontend`: Next.js app
- `services/core`: Django + DRF service
- `services/game`: FastAPI service
- `postgres`: PostgreSQL database
- `redis`: Redis
- `nginx`: public entrypoint and static-file server

## Environment model

- `compose.yaml` contains shared service definitions and production-safe defaults
- `compose.override.dev.yaml` adds bind mounts, dev servers, and host-exposed app ports
- `compose.override.prod.yaml` keeps runtime targets and production settings explicit
- Use `ENV=dev` or `ENV=prod` with `make`, or the shortcut targets below

## First-time setup

1. `make init`
2. Update `.env`
3. For production values, at minimum set `CORE_SECRET_KEY`, `CORE_DEBUG=False`, and the real host/origin variables

## Run development

1. `make up-dev`
2. Open [http://localhost:8080](http://localhost:8080)
3. Optional direct debug ports:
   - frontend: `http://localhost:3000`
   - core: `http://localhost:8000/health/`
   - game: `http://localhost:8005/health`

Development uses live-reload containers for Django, FastAPI, and Next.js, while nginx still sits in front so browser traffic matches the reverse-proxy shape.

## Run production-like stack

1. Review `.env` and switch it to production-safe values
2. `make up-prod`
3. Open [http://localhost:8080](http://localhost:8080)

`make up-prod` runs Django migrations and `collectstatic` before bringing the full stack up. In production mode, nginx serves Django static assets directly from the shared volume, and the frontend runs from a standalone Next.js build instead of the dev server.

## Useful commands

- `make build-dev`
- `make build-prod`
- `make logs ENV=dev`
- `make logs ENV=prod`
- `make ps ENV=prod`
- `make bootstrap ENV=prod`
- `make migrate-core ENV=prod`
- `make collectstatic-core ENV=prod`
- `make check-all ENV=dev`

## Notes

- Access the app through nginx for both environments so the frontend can use same-origin `/api` and `/api/game` URLs
- PostgreSQL and Redis are exposed to the host only in development
