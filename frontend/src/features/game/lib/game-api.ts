import { CORE_API_BASE } from "@/lib/api";

export type PlayerDetail = {
  id: string;
  username: string;
};

export type GameDetail = {
  id: string;
  white_player: PlayerDetail | null;
  black_player: PlayerDetail | null;
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  termination: string | null;
  rated: boolean;
  rating_category: string | null;
  time_control: string | null;
  started_at: string;
  ended_at: string | null;
  move_count: number;
  initial_time_ms: number;
  increment_ms: number;
  fen_final: string;
  pgn: string;
  white_rating_before: number | null;
  white_rating_after: number | null;
  white_rating_delta: number | null;
  black_rating_before: number | null;
  black_rating_after: number | null;
  black_rating_delta: number | null;
  rating_applied_at: string | null;
};

export async function getGameDetail(gameId: string): Promise<GameDetail | null> {
  const response = await fetch(`${CORE_API_BASE}/game-history/${gameId}/`);
  if (!response.ok) {
    return null;
  }
  return response.json();
}
