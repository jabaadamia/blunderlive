import { coordToIndex, indexToCoord } from "./coords";
import { INITIAL_FEN, parseFen, stateToFen } from "./fen";
import {
  getLegalMoves,
  isCheck,
  isCheckmate,
  makeMove,
} from "./moveGen";
import type { GameState, Move, PieceType } from "./types";

export type MoveHistoryEntry = {
  ply: number;
  uci: string;
  san: string;
  move: Move;
  state: GameState;
  fen: string;
};

const SAN_PIECE_SYMBOL: Record<PieceType, string> = {
  p: "",
  n: "N",
  b: "B",
  r: "R",
  q: "Q",
  k: "K",
};

function isSquareCoordinate(value: string) {
  return /^[a-h][1-8]$/i.test(value);
}

function getFile(index: number) {
  return indexToCoord(index)[0];
}

function getRank(index: number) {
  return indexToCoord(index)[1];
}

function isCaptureMove(state: GameState, move: Move) {
  const piece = state.board[move.from];

  if (!piece) {
    return false;
  }

  if (state.board[move.to]) {
    return true;
  }

  return piece.type === "p" && move.to === state.enPassantTarget;
}

function getDisambiguation(state: GameState, move: Move) {
  const piece = state.board[move.from];

  if (!piece || piece.type === "p" || piece.type === "k") {
    return "";
  }

  const ambiguousMoves = getLegalMoves(state).filter((candidate) => {
    if (candidate.from === move.from) {
      return false;
    }

    const candidatePiece = state.board[candidate.from];

    return (
      candidate.to === move.to &&
      candidatePiece?.type === piece.type &&
      candidatePiece.color === piece.color
    );
  });

  if (ambiguousMoves.length === 0) {
    return "";
  }

  const sameFile = ambiguousMoves.some(
    (candidate) => getFile(candidate.from) === getFile(move.from),
  );
  const sameRank = ambiguousMoves.some(
    (candidate) => getRank(candidate.from) === getRank(move.from),
  );

  if (!sameFile) {
    return getFile(move.from);
  }

  if (!sameRank) {
    return getRank(move.from);
  }

  return indexToCoord(move.from);
}

export function parseUciMove(uci: string) {
  if (uci.length < 4) {
    return null;
  }

  const fromSquare = uci.slice(0, 2);
  const toSquare = uci.slice(2, 4);

  if (!isSquareCoordinate(fromSquare) || !isSquareCoordinate(toSquare)) {
    return null;
  }

  const promotion = uci[4]?.toLowerCase();

  return {
    from: coordToIndex(fromSquare),
    to: coordToIndex(toSquare),
    promotion:
      promotion && ["q", "r", "b", "n"].includes(promotion)
        ? (promotion as PieceType)
        : undefined,
  };
}

export function getLegalMoveFromUci(state: GameState, uci: string) {
  const parsedMove = parseUciMove(uci);

  if (!parsedMove) {
    return null;
  }

  return (
    getLegalMoves(state).find(
      (candidate) =>
        candidate.from === parsedMove.from &&
        candidate.to === parsedMove.to &&
        candidate.promotion === parsedMove.promotion,
    ) ?? null
  );
}

export function moveToSan(state: GameState, move: Move) {
  const piece = state.board[move.from];

  if (!piece) {
    return "";
  }

  if (piece.type === "k" && Math.abs(move.from - move.to) === 2) {
    const nextState = makeMove(state, move);
    const suffix = isCheckmate(nextState) ? "#" : isCheck(nextState) ? "+" : "";
    return `${move.to > move.from ? "O-O" : "O-O-O"}${suffix}`;
  }

  const capture = isCaptureMove(state, move);
  const destination = indexToCoord(move.to);
  const disambiguation = getDisambiguation(state, move);
  const piecePrefix =
    piece.type === "p"
      ? capture
        ? getFile(move.from)
        : ""
      : `${SAN_PIECE_SYMBOL[piece.type]}${disambiguation}`;
  const captureMarker = capture ? "x" : "";
  const promotion = move.promotion ? `=${SAN_PIECE_SYMBOL[move.promotion]}` : "";
  const nextState = makeMove(state, move);
  const suffix = isCheckmate(nextState) ? "#" : isCheck(nextState) ? "+" : "";

  return `${piecePrefix}${captureMarker}${destination}${promotion}${suffix}`;
}

export function buildMoveHistory(moves: string[], initialFen = INITIAL_FEN) {
  const history: MoveHistoryEntry[] = [];
  let state = parseFen(initialFen);

  for (const [index, uci] of moves.entries()) {
    const move = getLegalMoveFromUci(state, uci) ?? parseUciMove(uci);

    if (!move) {
      break;
    }

    const san = getLegalMoveFromUci(state, uci)
      ? moveToSan(state, move)
      : uci;
    state = makeMove(state, move);

    history.push({
      ply: index + 1,
      uci,
      san,
      move,
      state,
      fen: stateToFen(state),
    });
  }

  return history;
}

export function getStateAtPly(
  moves: string[],
  ply: number,
  initialFen = INITIAL_FEN,
) {
  if (ply <= 0) {
    return parseFen(initialFen);
  }

  const history = buildMoveHistory(moves, initialFen);
  return history[Math.min(ply, history.length) - 1]?.state ?? parseFen(initialFen);
}
