export const CORE_API_BASE =
  process.env.NEXT_PUBLIC_CORE_API_BASE_URL ?? "/api";

export const GAME_API_BASE =
  process.env.NEXT_PUBLIC_GAME_API_BASE_URL ?? "/api/game";

export const AUTH_API_BASE = `${CORE_API_BASE}/auth`;
export const FRONTEND_AUTH_API_BASE = "/auth-api";

export const ACCESS_TOKEN_STORAGE_KEY = "blunderlive.accessToken";
