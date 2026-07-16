"use client";

import { CORE_API_BASE } from "@/lib/api";
import {
  getUsableAccessToken,
  refreshAccessToken,
} from "@/features/auth/lib/auth-client";
import type { Rating } from "@/features/auth/types";

export const RATING_CATEGORIES = ["bullet", "blitz", "rapid", "puzzle"] as const;

export type RatingCategory = (typeof RATING_CATEGORIES)[number];

export type RatingHistoryEntry = {
  category: string;
  source: string;
  previous_value: number;
  new_value: number;
  delta: number;
  game_id: string | null;
  notes: string;
  created_at: string;
};

export type PlayerSummary = {
  id: string;
  username: string;
};

export type GameSummary = {
  id: string;
  white_player: PlayerSummary | null;
  black_player: PlayerSummary | null;
  result: string;
  termination: string;
  rated: boolean;
  rating_category: string | null;
  time_control: string;
  started_at: string;
  ended_at: string;
  move_count: number;
};

export type CursorPage<T> = {
  next: string | null;
  previous: string | null;
  results: T[];
};

type RequestOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

function withCategory(url: URL, category?: string | null) {
  if (category) {
    url.searchParams.set("category", category);
  }

  return url.toString();
}

async function profileRequest<T>(
  url: string,
  { retryOnUnauthorized = true, ...options }: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const token = await getUsableAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return profileRequest<T>(url, {
        ...options,
        retryOnUnauthorized: false,
      });
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getUserRatings(userId: string) {
  return profileRequest<Rating[]>(`${CORE_API_BASE}/ratings/users/${userId}/`);
}

export function getUserRatingHistory(userId: string, category: string) {
  const url = new URL(
    `${CORE_API_BASE}/ratings/users/${userId}/history/`,
    window.location.origin,
  );

  return profileRequest<RatingHistoryEntry[]>(withCategory(url, category));
}

export function getUserGames(
  userId: string,
  category: string,
  nextUrl?: string | null,
) {
  if (nextUrl) {
    // Django returns absolute URLs (e.g. http://localhost/api/...).
    // Strip the origin so the request goes through our proxy.
    const parsed = new URL(nextUrl, window.location.origin);
    const relativeUrl = parsed.pathname + parsed.search;
    return profileRequest<CursorPage<GameSummary>>(relativeUrl);
  }

  const url = new URL(
    `${CORE_API_BASE}/game-history/users/${userId}/`,
    window.location.origin,
  );

  return profileRequest<CursorPage<GameSummary>>(withCategory(url, category));
}

export function getMyGames(category?: string | null) {
  const url = new URL(`${CORE_API_BASE}/game-history/me/`, window.location.origin);
  return profileRequest<CursorPage<GameSummary>>(withCategory(url, category));
}
