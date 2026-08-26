# Core Service (`services/core`)

Django + DRF service owning identity, persistent game records, and ratings. Exposed publicly at `/api/*` behind the edge, and reachable internally as `core.blunderlive.local:8000` in the hosted stack or `http://core:8000` in compose.

## Responsibilities

- **Accounts** — register / login / logout / refresh-token endpoints, issuing RS256 JWT access tokens; refresh tokens ride HTTP-only cookies
- **Users** — current-user lookup, plus the player lookup the game service uses
- **Ratings** — per-user rating state and history
- **Games** — finished-game persistence and history, fed by the Redis-stream pipeline from the game service
- **Async worker** — `core-worker` runs `manage.py process_finished_games`, a Redis Streams consumer that persists finished games and publishes processed events back out for rating updates

## API surface

| Prefix | Purpose |
| --- | --- |
| `/api/auth/` | `register/`, `login/`, `logout/`, `refresh-token/`, `status/` |
| `/api/users/` | `me/`, `status/`, `game-players/` |
| `/api/ratings/` | `me/`, `me/history/`, `users/<uuid>/`, `users/<uuid>/history/` |
| `/api/game-history/` | `me/`, `users/<uuid>/`, `<uuid:game_id>/` |
| `/health/live`, `/health/ready` | Liveness / readiness probes |
| `/api/schema/` | OpenAPI schema (drf-spectacular) |

## Auth contract

Core signs RS256 JWT access tokens (`user_id` claim, token type `access`); the game service verifies them locally with the shared public key, with no per-request call back to core. Refresh tokens rotate (`ROTATE_REFRESH_TOKENS`) and ride an HTTP-only cookie whose `Secure` flag follows the debug setting.

Signing keys are read from `CORE_JWT_PRIVATE_KEY_PATH` / `CORE_JWT_PUBLIC_KEY_PATH`; development uses the generated pair under `infra/dev-jwt/`.

## Configuration

Key env vars (full list in `compose.yaml`): `CORE_SECRET_KEY`, `CORE_DEBUG`, `CORE_ALLOWED_HOSTS`, `CORE_DATABASE_URL`, `REDIS_URL`, `CORE_CSRF_TRUSTED_ORIGINS`, `CORE_SECURE_*` flags, Gunicorn worker settings, and the Redis stream/group names shared with the game service.

## Migrations

Migrations don't run in the web container's start command (that's `collectstatic` + gunicorn only). They run as a one-off ECS task from CI on every deploy, or locally via `make bootstrap ENV=prod` / `make migrate-core ENV=prod`.

## Development

```bash
make up-dev                 # full stack, live reload
make test-core               # pytest suite
make core-shell ENV=dev      # shell into the container
```