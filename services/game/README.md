# Game Service Foundation Notes

This service currently implements only the game-service foundation:

- local JWT verification in the game service
- Redis-backed startup health baseline
- structured logging baseline
- domain and transport contracts for future matchmaking and websocket flows

It does **not** yet implement:

- matchmaking logic
- websocket game session handling
- move validation
- persistence of finished games

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

Production must override it with real mounted secret files via:

- `CORE_JWT_PRIVATE_KEY_PATH`
- `CORE_JWT_PUBLIC_KEY_PATH`
- `GAME_JWT_PUBLIC_KEY_PATH`
