import { parseFen } from "@/lib/chessboard/fen";
import { getLegalMoveFromUci, moveToSan, parseUciMove } from "@/lib/chessboard/history";
import { makeMove } from "@/lib/chessboard/moveGen";

export interface SanMoveToken {
  ply: number;
  moveNumber: number;
  isWhite: boolean;
  san: string;
  uci: string;
}

export function convertUciPvToSan(initialFen: string, uciMoves: string[]): SanMoveToken[] {
  let state = parseFen(initialFen);
  const result: SanMoveToken[] = [];

  for (let i = 0; i < uciMoves.length; i++) {
    const uci = uciMoves[i];
    const move = getLegalMoveFromUci(state, uci);
    if (!move) break;

    const san = moveToSan(state, move);
    const isWhite = state.turn === "w";
    const moveNumber = state.fullMoves;

    result.push({
      ply: i + 1,
      moveNumber,
      isWhite,
      san: san || uci,
      uci,
    });

    state = makeMove(state, move);
  }

  return result;
}

export function formatSanPvString(initialFen: string, uciMoves: string[], maxMoves = 6): string {
  const tokens = convertUciPvToSan(initialFen, uciMoves.slice(0, maxMoves));
  if (tokens.length === 0) return "";

  let formatted = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i === 0) {
      formatted += t.isWhite ? `${t.moveNumber}. ${t.san}` : `${t.moveNumber}... ${t.san}`;
    } else if (t.isWhite) {
      formatted += ` ${t.moveNumber}. ${t.san}`;
    } else {
      formatted += ` ${t.san}`;
    }
  }

  return formatted;
}
