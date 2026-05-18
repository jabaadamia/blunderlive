import { parseFen, stateToFen } from "@/lib/chessboard/fen";
import { parseUciMove } from "@/lib/chessboard/history";
import { makeMove } from "@/lib/chessboard/moveGen";

import type { GameSnapshot } from "../types";

export function applyUciMoveToSnapshot(snapshot: GameSnapshot, uci: string) {
  const move = parseUciMove(uci);

  if (!move) {
    return null;
  }

  const nextState = makeMove(parseFen(snapshot.fen), move);

  return {
    ...snapshot,
    fen: stateToFen(nextState),
    moves: [...snapshot.moves, uci],
    move_count: snapshot.move_count + 1,
  };
}
