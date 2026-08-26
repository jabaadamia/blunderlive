# Game Service (`services/game`)

FastAPI service owning the live game loop: matchmaking, active-game state, clocks, and WebSocket play. Exposed at `/api/game/*` behind the edge (FastAPI runs with `root_path=/api/game` in hosted deploys, so internal routes stay prefix-free), and reachable internally as `game.blunderlive.local:8005` in the hosted stack or `http://game:8005` in compose.

## Responsibilities

- Local JWT verification for all game traffic
- Redis-backed matchmaking, active-game snapshots, clock/deadline state, event fan-out
- A separate `game-worker` process handling matchmaking sweeps and deadlines
- Structured logging baseline
- Publishing finished games to Redis Streams for core to persist

The `game` process itself only holds its own open WebSocket connections in memory and relays outbound events via Redis Pub/Sub — clocks and matchmaking survive an ordinary web task restart because the durable state lives in Redis, not in the process.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /matchmaking/join` | Enter the queue; returns a match once paired |
| `POST /matchmaking/leave` | Leave the queue |
| `GET /matchmaking/status` | Current queue/match status |
| `WS /games/{game_id}/ws` | Live game session — moves, clocks, events |
| `GET /health/live`, `/health/ready` | Liveness; readiness also checks Redis |

Browser-facing paths get an `/api/game` prefix from the edge (e.g. `/api/game/games/{id}/ws`). Since the ALB can't rewrite paths, FastAPI strips the prefix itself via `root_path`.

## Auth contract

Core issues JWTs; game verifies them locally with no request-time call back to core. Required claim: `user_id`; required token type: `access`; algorithm: RS256. Server-to-server calls to core (rating updates on processed games) use `CORE_API_BASE_URL`.

## JWT keys

Development and CI use an RSA keypair under `infra/dev-jwt/` — the folder is tracked, but the key files themselves are generated locally/in CI and never committed. This is a dev/test shortcut only.

Production overrides it with real key material via env values or mounted secret files: `CORE_JWT_PRIVATE_KEY`, `CORE_JWT_PUBLIC_KEY`, `GAME_JWT_PUBLIC_KEY`, or their `_PATH` equivalents.

## Configuration

Pydantic settings, read from env (`app/config.py`): `REDIS_URL`, `CORS_ALLOWED_ORIGINS`, `CORE_API_BASE_URL`, `GAME_JWT_PUBLIC_KEY(_PATH)`, `APP_NAME` / `APP_ENV` / `LOG_LEVEL`, `GAME_PORT`, and the Redis stream/consumer-group names shared with core (`CORE_GAMES_FINISHED_STREAM`, `CORE_GAMES_PROCESSED_STREAM`, `GAME_GAMES_PROCESSED_CONSUMER_GROUP`).

## Development

```bash
make up-dev                 # full stack, live reload
make test-game               # pytest suite
make game-shell ENV=dev      # shell into the container
```