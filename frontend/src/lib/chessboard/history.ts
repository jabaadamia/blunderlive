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
  whiteTimeLeftMs?: number;
  blackTimeLeftMs?: number;
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

function stripSanSuffix(san: string) {
  return san.replace(/[+#]$/, "");
}

function sanToMove(state: GameState, san: string): Move | null {
  const target = stripSanSuffix(san);

  for (const move of getLegalMoves(state)) {
    if (stripSanSuffix(moveToSan(state, move)) === target) {
      return move;
    }
  }

  return null;
}

function extractSanTokens(pgn: string): string[] {
  const movetext = pgn
    .replace(/\{[^}]*\}/g, "") // strip comments
    .replace(/\[[^\]]*\]/g, "") // strip header tags
    .trim();

  return movetext
    .split(/\s+/)
    .filter(
      (token) =>
        token &&
        !/^\d+\.+$/.test(token) &&
        !["1-0", "0-1", "1/2-1/2", "*"].includes(token),
    );
}

export function pgnToUciMoves(pgn: string, initialFen = INITIAL_FEN): string[] {
  let state = parseFen(initialFen);
  const uciMoves: string[] = [];

  for (const item of extractSanAndClockTokens(pgn)) {
    const move = sanToMove(state, item.san);
    if (!move) break; // malformed/unparseable PGN - stop rather than desync

    uciMoves.push(indexToCoord(move.from) + indexToCoord(move.to) + (move.promotion ?? ""));
    state = makeMove(state, move);
  }

  return uciMoves;
}

export function extractMovetext(pgn: string): string {
  const parts = pgn.trim().split(/\r?\n\r?\n/);
  if (parts.length > 1) {
    return parts.slice(1).join("\n");
  }
  return pgn.replace(/^\s*\[[^\]]*\]\s*/gm, "").trim();
}

export function parsePgnClockMs(comment: string): number | null {
  const match = comment.match(/%clk\s+(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?/i);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const msFraction = match[4] ? parseInt(match[4].padEnd(3, "0").slice(0, 3), 10) : 0;

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + msFraction;
}

export interface PgnMoveToken {
  san: string;
  clockMs: number | null;
}

export function extractSanAndClockTokens(pgn: string): PgnMoveToken[] {
  const movetext = extractMovetext(pgn);
  const tokenRegex = /(\{[^}]*\})|(\S+)/g;
  const result: PgnMoveToken[] = [];

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(movetext)) !== null) {
    const commentGroup = match[1];
    const textGroup = match[2];

    if (commentGroup) {
      if (result.length > 0) {
        const clock = parsePgnClockMs(commentGroup);
        if (clock !== null) {
          result[result.length - 1].clockMs = clock;
        }
      }
    } else if (textGroup) {
      if (
        !/^\d+\.+$/.test(textGroup) &&
        !["1-0", "0-1", "1/2-1/2", "*"].includes(textGroup)
      ) {
        result.push({ san: textGroup, clockMs: null });
      }
    }
  }

  return result;
}

export function buildMoveHistoryFromPgn(
  pgn: string,
  initialFen = INITIAL_FEN,
  initialTimeMs = 0,
): MoveHistoryEntry[] {
  const tokens = extractSanAndClockTokens(pgn);
  const history: MoveHistoryEntry[] = [];
  let state = parseFen(initialFen);

  let currentWhiteMs = initialTimeMs;
  let currentBlackMs = initialTimeMs;

  for (const [index, token] of tokens.entries()) {
    const move = sanToMove(state, token.san);
    if (!move) break;

    const uci = indexToCoord(move.from) + indexToCoord(move.to) + (move.promotion ?? "");
    const san = moveToSan(state, move);
    state = makeMove(state, move);

    const isWhiteMove = index % 2 === 0;
    if (token.clockMs !== null) {
      if (isWhiteMove) {
        currentWhiteMs = token.clockMs;
      } else {
        currentBlackMs = token.clockMs;
      }
    }

    history.push({
      ply: index + 1,
      uci,
      san,
      move,
      state,
      fen: stateToFen(state),
      whiteTimeLeftMs: currentWhiteMs,
      blackTimeLeftMs: currentBlackMs,
    });
  }

  return history;
}

export interface MoveTreeNode {
  id: string;
  ply: number;
  uci: string;
  san: string;
  move: Move;
  state: GameState;
  fen: string;
  whiteTimeLeftMs?: number;
  blackTimeLeftMs?: number;
  parentId: string | null;
  children: string[]; // children[0] = mainline continuation, rest = variations
}

export interface MoveTree {
  nodes: Record<string, MoveTreeNode>;
  rootId: string;
}

export const ROOT_NODE_ID = "root";

function tokenizePgnMovetext(pgn: string): string[] {
  const movetext = extractMovetext(pgn);
  const tokens: string[] = [];
  const re = /(\{[^}]*\})|([()])|([^\s()]+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(movetext)) !== null) {
    if (match[1]) tokens.push(match[1]);
    else if (match[2]) tokens.push(match[2]);
    else if (match[3]) tokens.push(match[3]);
  }

  return tokens;
}

function isMoveNumberToken(token: string) {
  return /^\d+\.+$/.test(token);
}

function isResultToken(token: string) {
  return ["1-0", "0-1", "1/2-1/2", "*"].includes(token);
}

/**
 * Parses a sequence of moves starting from `parentId`, mutating `nodes`.
 * A "(" branches an alternative to the *last move played in this call*
 * (i.e. a sibling under that move's parent), per PGN variation semantics.
 * Returns the index just past the token stream consumed (past the
 * closing ")" if this call is parsing a variation).
 */
function parseLine(
  tokens: string[],
  startIndex: number,
  parentId: string,
  nodes: Record<string, MoveTreeNode>,
  counter: { n: number },
): number {
  let currentId = parentId;
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === ")") {
      return index + 1;
    }

    if (token === "(") {
      const branchParentId = nodes[currentId].parentId;
      if (branchParentId === null) {
        // Malformed PGN: variation with nothing to branch from.
        index++;
        continue;
      }
      index = parseLine(tokens, index + 1, branchParentId, nodes, counter);
      continue;
    }

    if (isMoveNumberToken(token) || isResultToken(token) || token.startsWith("{")) {
      index++;
      continue;
    }

    const currentNode = nodes[currentId];
    const move = sanToMove(currentNode.state, token);

    if (!move) {
      index++;
      continue;
    }

    const moverColor = currentNode.state.board[move.from]?.color;
    const nextState = makeMove(currentNode.state, move);
    const id = `n${counter.n++}`;

    const node: MoveTreeNode = {
      id,
      ply: currentNode.ply + 1,
      uci: indexToCoord(move.from) + indexToCoord(move.to) + (move.promotion ?? ""),
      san: moveToSan(currentNode.state, move),
      move,
      state: nextState,
      fen: stateToFen(nextState),
      whiteTimeLeftMs: currentNode.whiteTimeLeftMs,
      blackTimeLeftMs: currentNode.blackTimeLeftMs,
      parentId: currentId,
      children: [],
    };

    nodes[id] = node;
    nodes[currentId].children.push(id);
    currentId = id;
    index++;

    // A clock comment immediately following the move belongs to it.
    const next = tokens[index];
    if (next?.startsWith("{")) {
      const clock = parsePgnClockMs(next.slice(1, -1));
      if (clock !== null) {
        if (moverColor === "w") node.whiteTimeLeftMs = clock;
        else if (moverColor === "b") node.blackTimeLeftMs = clock;
      }
      index++;
    }
  }

  return index;
}

export function buildMoveTreeFromPgn(
  pgn: string,
  initialFen = INITIAL_FEN,
  initialTimeMs = 0,
): MoveTree {
  const rootState = parseFen(initialFen);
  const nodes: Record<string, MoveTreeNode> = {
    [ROOT_NODE_ID]: {
      id: ROOT_NODE_ID,
      ply: 0,
      uci: "",
      san: "",
      move: null as unknown as Move,
      state: rootState,
      fen: stateToFen(rootState),
      whiteTimeLeftMs: initialTimeMs,
      blackTimeLeftMs: initialTimeMs,
      parentId: null,
      children: [],
    },
  };

  const tokens = tokenizePgnMovetext(pgn);
  parseLine(tokens, 0, ROOT_NODE_ID, nodes, { n: 0 });

  return { nodes, rootId: ROOT_NODE_ID };
}

/** Ancestors of `nodeId` (excluding root), root-to-node order. */
export function getPathToNode(tree: MoveTree, nodeId: string): string[] {
  const path: string[] = [];
  let current: string | null = nodeId;

  while (current !== null && current !== tree.rootId) {
    path.unshift(current);
    current = tree.nodes[current].parentId;
  }

  return path;
}

/**
 * The line `nodeId` belongs to: its ancestors plus the mainline
 * continuation from `nodeId` to the end of that branch.
 */
export function getActiveLine(tree: MoveTree, nodeId: string): MoveTreeNode[] {
  const path = getPathToNode(tree, nodeId);
  let node = tree.nodes[path.length > 0 ? path[path.length - 1] : tree.rootId];

  while (node.children.length > 0) {
    const nextId = node.children[0];
    path.push(nextId);
    node = tree.nodes[nextId];
  }

  return path.map((id) => tree.nodes[id]);
}

export function buildLinearMoveTree(
  entries: MoveHistoryEntry[],
  initialFen = INITIAL_FEN,
): MoveTree {
  const rootState = parseFen(initialFen);
  const nodes: Record<string, MoveTreeNode> = {
    [ROOT_NODE_ID]: {
      id: ROOT_NODE_ID,
      ply: 0,
      uci: "",
      san: "",
      move: null as unknown as Move,
      state: rootState,
      fen: stateToFen(rootState),
      parentId: null,
      children: [],
    },
  };

  let parentId = ROOT_NODE_ID;
  for (const entry of entries) {
    const id = `p${entry.ply}`;
    nodes[id] = { ...entry, id, parentId, children: [] };
    nodes[parentId].children.push(id);
    parentId = id;
  }

  return { nodes, rootId: ROOT_NODE_ID };
}

export function addMoveToTree(
  tree: MoveTree,
  parentId: string,
  move: Move,
): { tree: MoveTree; nodeId: string } {
  const parent = tree.nodes[parentId];

  // if this exact move already exists as a child, just reuse it.
  const existingChildId = parent.children.find((childId) => {
    const child = tree.nodes[childId];
    return (
      child.move &&
      child.move.from === move.from &&
      child.move.to === move.to &&
      child.move.promotion === move.promotion
    );
  });

  if (existingChildId) {
    return { tree, nodeId: existingChildId };
  }

  const nextState = makeMove(parent.state, move);
  const id = `x${Object.keys(tree.nodes).length}-${Date.now().toString(36)}`;

  const newNode: MoveTreeNode = {
    id,
    ply: parent.ply + 1,
    uci: indexToCoord(move.from) + indexToCoord(move.to) + (move.promotion ?? ""),
    san: moveToSan(parent.state, move),
    move,
    state: nextState,
    fen: stateToFen(nextState),
    whiteTimeLeftMs: parent.whiteTimeLeftMs,
    blackTimeLeftMs: parent.blackTimeLeftMs,
    parentId,
    children: [],
  };

  const nodes = {
    ...tree.nodes,
    [id]: newNode,
    [parentId]: { ...parent, children: [...parent.children, id] },
  };

  return { tree: { ...tree, nodes }, nodeId: id };
}
