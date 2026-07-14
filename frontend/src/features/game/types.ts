export interface GameParticipant {
  user_id: string;
  color: "white" | "black";
}

export interface GameSnapshot {
  game_id: string;
  status: "pending" | "active" | "finished" | "abandoned";
  fen: string;
  created_at: string;
  last_move_at: string | null;
  white: GameParticipant;
  black: GameParticipant;
  moves: string[];
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  termination: string | null;
  move_count: number;
  rated: boolean;
  rating_category: string | null;
  initial_time_ms: number;
  increment_ms: number;
  draw_offer_by: string | null;
  version: number;
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
}

export interface RatingUpdateConfirmed {
  game_id: string;
  white_player_id: string;
  black_player_id: string;
  rated: boolean;
  rating_category: string | null;
  white_rating_change: RatingChange | null;
  black_rating_change: RatingChange | null;
}
