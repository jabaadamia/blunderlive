# Game Service Foundation Notes

This service owns the live game loop:

- local JWT verification in the game service
- Redis-backed matchmaking, active game snapshots, clocks, and event fan-out
- a separate `game-worker` process for matchmaking, deadline sweeping, and processed-game events
- structured logging baseline
- WebSocket game session handling

`game` is the HTTP/WebSocket process. It keeps only local socket connections in memory and
relays outbound game events from Redis Pub/Sub. `game-worker` owns background loops, so clocks
and matchmaking survive ordinary web task restarts.

## Auth Contract

- `core` issues JWT access tokens
- `game` verifies them locally
- no request-time call to `core` is made for normal move/game authentication
- required claim: `user_id`
- required token type: `access`
- algorithm: `RS256`

## Development Shortcut

Development and CI use an RSA keypair under `infra/dev-jwt/`.
The folder is tracked, but key files are generated locally/CI and are not
committed.

This remains an intentional local/dev/test shortcut only.

Production must override it with real key material via env secret values or mounted secret files:

- `CORE_JWT_PRIVATE_KEY`
- `CORE_JWT_PUBLIC_KEY`
- `GAME_JWT_PUBLIC_KEY`
- `CORE_JWT_PRIVATE_KEY_PATH`
- `CORE_JWT_PUBLIC_KEY_PATH`
- `GAME_JWT_PUBLIC_KEY_PATH`

## Health Checks

- `/health/live` only confirms the process can respond.
- `/health/ready` checks Redis connectivity.
