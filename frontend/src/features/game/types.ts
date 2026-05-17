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
}
