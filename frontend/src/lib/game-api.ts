import { GAME_API_BASE } from "@/lib/api";
import {
  getUsableAccessToken,
  refreshAccessToken,
} from "@/features/auth/lib/auth-client";

export interface TimeControl {
  initial_time_ms: number;
  increment_ms: number;
}

export interface MatchmakingJoinResponse {
  status: string;
  queue: string;
  rated: boolean;
  time_control: TimeControl;
}

export type MatchmakingState = "idle" | "queued" | "matched";

export type MatchmakingPlayerDisplay = {
  user_id: string;
  username: string;
  rating: number | null;
};

export interface MatchmakingStatusResponse {
  state: MatchmakingState;
  queue?: string;
  rated?: boolean;
  initial_time_ms?: number;
  increment_ms?: number;
  joined_at?: string;
  active_game_id?: string;
  white_player?: MatchmakingPlayerDisplay;
  black_player?: MatchmakingPlayerDisplay;
}

async function gameRequest<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const token = await getUsableAccessToken();
  const res = await fetch(`${GAME_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  if (res.status === 401 && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return gameRequest<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function joinMatchmaking(
  timeControl: TimeControl = { initial_time_ms: 300_000, increment_ms: 0 },
  rated = true,
): Promise<MatchmakingJoinResponse> {
  return gameRequest<MatchmakingJoinResponse>("/matchmaking/join", {
    method: "POST",
    body: JSON.stringify({ rated, time_control: timeControl }),
  });
}

export async function leaveMatchmaking(): Promise<void> {
  return gameRequest<void>("/matchmaking/leave", { method: "POST" });
}

export async function getMatchmakingStatus(): Promise<MatchmakingStatusResponse> {
  return gameRequest<MatchmakingStatusResponse>("/matchmaking/status");
}
