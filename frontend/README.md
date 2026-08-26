# Frontend

Next.js (App Router) client for BlunderLive - auth, matchmaking, live board play, game history, and post-game analysis with an in-browser Stockfish engine.

## Stack

- Next.js 16 + React 19, TypeScript, Tailwind CSS 4
- Feature-first layout under `src/features/`: `auth`, `matchmaking`, `game`, `analysis`, `profile`, `ratings`
- `recharts` for rating-history charts, `react-icons` for UI icons
- Stockfish 18 (single-threaded WASM build), shipped as static assets from `public/stockfish/`

## Routing

All browser traffic is same-origin; the edge (nginx or ALB) routes it onward:

| Path | Goes to |
| --- | --- |
| `/api/*` | core (Django) - auth, users, ratings, game history |
| `/api/game/*` | game (FastAPI) - matchmaking REST and the live WebSocket at `/api/game/games/{id}/ws` |
| `/auth-api/*` | Next.js server routes (`src/app/auth-api/`) that proxy to core's login/register/refresh/logout endpoints, managing the HTTP-only refresh cookie server-side |

Server-side proxying targets `INTERNAL_CORE_URL` / `INTERNAL_GAME_URL` (`http://core:8000` in compose; the Cloud Map FQDNs `core.blunderlive.local` / `game.blunderlive.local` in the hosted stack). Browser-facing base paths are baked in at build time via `NEXT_PUBLIC_CORE_API_BASE_URL` / `NEXT_PUBLIC_GAME_API_BASE_URL`.

## Auth

- Access tokens live in memory only. A timer refreshes them ahead of expiry (60s skew) by hitting the cookie-backed `/auth-api/refresh-token/` route.
- The refresh token never reaches JavaScript - it's set as an HTTP-only cookie by the server routes (`src/features/auth/server/route-utils.ts`).
- JWT decoding for identity checks lives in `src/features/auth/lib/jwt.ts`.

## Live games

`src/hooks/useGameWebSocket.ts` owns the WebSocket lifecycle: connect to `/api/game/games/{id}/ws`, send moves, receive clock/event updates, handle reconnects.

## Development

```bash
make up-dev            # full stack behind nginx, http://localhost:8080
make test-frontend
make lint-frontend
make build-frontend    # production build check
```

Direct dev server: [http://localhost:3000](http://localhost:3000) when running the dev override.