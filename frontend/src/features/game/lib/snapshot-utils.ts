import { coordToIndex } from "@/lib/chessboard/coords";
import { parseFen, stateToFen } from "@/lib/chessboard/fen";
import { makeMove } from "@/lib/chessboard/moveGen";
import type { PieceType } from "@/lib/chessboard/types";

import type { GameSnapshot } from "../types";

function parseUciMove(uci: string) {
  if (uci.length < 4) {
    return null;
  }

  const from = coordToIndex(uci.slice(0, 2));
  const to = coordToIndex(uci.slice(2, 4));
  const promotion = (uci[4]?.toLowerCase() as PieceType | undefined) ?? undefined;

  return { from, to, promotion };
}

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
