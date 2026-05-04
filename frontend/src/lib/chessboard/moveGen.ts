import { Color, PieceType, Piece, Square, Board, GameState, Move, CastlingRights } from './types';


export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const createEmptyBoard = (): Board => new Array(64).fill(null);

// --- BOARD MATH & HELPERS ---

const indexToCoord = (i: number) => ({ r: Math.floor(i / 8), c: i % 8 });
const coordToIndex = (r: number, c: number) => r * 8 + c;
const inBounds = (r: number, c: number) => r >= 0 && r <= 7 && c >= 0 && c <= 7;
const getOpponent = (color: Color): Color => (color === 'w' ? 'b' : 'w');

// --- MOVE GENERATION ---

// Directional offsets for sliding pieces [dRow, dCol]
const DIRS = {
    r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    q: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
    k: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
};


export const isSquareAttacked = (state: GameState, targetIndex: number, attackingColor: Color): boolean => {
    const { board } = state;
    const { r: tr, c: tc } = indexToCoord(targetIndex);

    // Check Pawn attacks
    const pawnDir = attackingColor === 'w' ? 1 : -1;
    const pawnAttacks = [[pawnDir, -1], [pawnDir, 1]];
    for (const [dr, dc] of pawnAttacks) {
        if (inBounds(tr + dr, tc + dc)) {
            const sq = board[coordToIndex(tr + dr, tc + dc)];
            if (sq?.color === attackingColor && sq.type === 'p') return true;
        }
    }

    // Check Knights & Kings
    const stepPieces: Array<{ type: PieceType; dirs: number[][] }> = [
        { type: 'n', dirs: DIRS.n },
        { type: 'k', dirs: DIRS.k }
    ];
    for (const { type, dirs } of stepPieces) {
        for (const [dr, dc] of dirs) {
            if (inBounds(tr + dr, tc + dc)) {
                const sq = board[coordToIndex(tr + dr, tc + dc)];
                if (sq?.color === attackingColor && sq.type === type) return true;
            }
        }
    }

    // Check Sliding Pieces (Bishops, Rooks, Queens)
    const sliders: Array<{ types: PieceType[]; dirs: number[][] }> = [
        { types: ['b', 'q'], dirs: DIRS.b },
        { types: ['r', 'q'], dirs: DIRS.r }
    ];
    for (const { types, dirs } of sliders) {
        for (const [dr, dc] of dirs) {
            let cr = tr + dr, cc = tc + dc;
            while (inBounds(cr, cc)) {
                const sq = board[coordToIndex(cr, cc)];
                if (sq) {
                    if (sq.color === attackingColor && types.includes(sq.type)) return true;
                    break; // Blocked by piece
                }
                cr += dr; cc += dc;
            }
        }
    }
    return false;
};

/**
 * Generates all physical moves, ignoring if they leave the king in check.
 */
const getPseudoLegalMoves = (state: GameState): Move[] => {
    const moves: Move[] = [];
    const { board, turn, enPassantTarget } = state;

    for (let i = 0; i < 64; i++) {
        const piece = board[i];
        if (!piece || piece.color !== turn) continue;

        const { r, c } = indexToCoord(i);

        // -- PAWNS --
        if (piece.type === 'p') {
            const dir = turn === 'w' ? -1 : 1;
            const startRow = turn === 'w' ? 6 : 1;
            const promRow = turn === 'w' ? 0 : 7;

            // Forward move
            if (inBounds(r + dir, c) && !board[coordToIndex(r + dir, c)]) {
                addPawnMoves(moves, i, coordToIndex(r + dir, c), r + dir === promRow);
                // Double move
                if (r === startRow && !board[coordToIndex(r + dir * 2, c)]) {
                    moves.push({ from: i, to: coordToIndex(r + dir * 2, c) });
                }
            }
            // Captures
            for (const dc of [-1, 1]) {
                if (inBounds(r + dir, c + dc)) {
                    const toIdx = coordToIndex(r + dir, c + dc);
                    const target = board[toIdx];
                    if ((target && target.color !== turn) || toIdx === enPassantTarget) {
                        addPawnMoves(moves, i, toIdx, r + dir === promRow);
                    }
                }
            }
            continue;
        }

        // -- SLIDING PIECES (B, R, Q) --
        if (['b', 'r', 'q'].includes(piece.type)) {
            const dirs = DIRS[piece.type as 'b' | 'r' | 'q'];
            for (const [dr, dc] of dirs) {
                let cr = r + dr, cc = c + dc;
                while (inBounds(cr, cc)) {
                    const toIdx = coordToIndex(cr, cc);
                    const target = board[toIdx];
                    if (!target) {
                        moves.push({ from: i, to: toIdx });
                    } else {
                        if (target.color !== turn) moves.push({ from: i, to: toIdx }); // Capture
                        break; // Blocked
                    }
                    cr += dr; cc += dc;
                }
            }
        }

        // -- KNIGHTS & KINGS --
        if (piece.type === 'n' || piece.type === 'k') {
            const dirs = DIRS[piece.type as 'n' | 'k'];
            for (const [dr, dc] of dirs) {
                if (inBounds(r + dr, c + dc)) {
                    const toIdx = coordToIndex(r + dr, c + dc);
                    const target = board[toIdx];
                    if (!target || target.color !== turn) {
                        moves.push({ from: i, to: toIdx });
                    }
                }
            }
        }

        // -- CASTLING --
        if (piece.type === 'k') {
            const isAttacked = isSquareAttacked(state, i, getOpponent(turn));
            if (!isAttacked) {
                if (turn === 'w') {
                    if (state.castling.wK && !board[61] && !board[62] && !isSquareAttacked(state, 61, 'b')) moves.push({ from: 60, to: 62 });
                    if (state.castling.wQ && !board[59] && !board[58] && !board[57] && !isSquareAttacked(state, 59, 'b')) moves.push({ from: 60, to: 58 });
                } else {
                    if (state.castling.bK && !board[5] && !board[6] && !isSquareAttacked(state, 5, 'w')) moves.push({ from: 4, to: 6 });
                    if (state.castling.bQ && !board[3] && !board[2] && !board[1] && !isSquareAttacked(state, 3, 'w')) moves.push({ from: 4, to: 2 });
                }
            }
        }
    }
    return moves;
};

// Helper for pawn promotion
const addPawnMoves = (moves: Move[], from: number, to: number, isPromo: boolean) => {
    if (isPromo) {
        (['q', 'r', 'b', 'n'] as PieceType[]).forEach(prom => moves.push({ from, to, promotion: prom }));
    } else {
        moves.push({ from, to });
    }
};

/**
 * Applies a move and returns a completely new GameState (Immutable)
 */
export const makeMove = (state: GameState, move: Move): GameState => {
    const newBoard = [...state.board];
    const piece = newBoard[move.from]!;
    const target = newBoard[move.to];

    let enPassantTarget: number | null = null;
    let halfMoves = state.halfMoves + 1;

    // Reset half moves on capture or pawn push
    if (target || piece.type === 'p') halfMoves = 0;

    // Move piece
    newBoard[move.to] = piece;
    newBoard[move.from] = null;

    // En Passant Capture Logic
    if (piece.type === 'p' && move.to === state.enPassantTarget) {
        const captureSquare = state.turn === 'w' ? move.to + 8 : move.to - 8;
        newBoard[captureSquare] = null;
    }

    // Set En Passant Target for next turn
    if (piece.type === 'p' && Math.abs(move.from - move.to) === 16) {
        enPassantTarget = state.turn === 'w' ? move.from - 8 : move.from + 8;
    }

    // Promotion
    if (move.promotion) {
        newBoard[move.to] = { type: move.promotion, color: state.turn };
    }

    // Castling Logic (Move the Rook)
    if (piece.type === 'k' && Math.abs(move.from - move.to) === 2) {
        if (move.to === 62) { newBoard[61] = newBoard[63]; newBoard[63] = null; } // wK
        if (move.to === 58) { newBoard[59] = newBoard[56]; newBoard[56] = null; } // wQ
        if (move.to === 6)  { newBoard[5] = newBoard[7]; newBoard[7] = null; }    // bK
        if (move.to === 2)  { newBoard[3] = newBoard[0]; newBoard[0] = null; }    // bQ
    }

    // Update Castling Rights
    const newCastling = { ...state.castling };
    if (piece.type === 'k') {
        if (state.turn === 'w') { newCastling.wK = false; newCastling.wQ = false; }
        else { newCastling.bK = false; newCastling.bQ = false; }
    }
    if (piece.type === 'r') {
        if (move.from === 63) newCastling.wK = false;
        if (move.from === 56) newCastling.wQ = false;
        if (move.from === 7) newCastling.bK = false;
        if (move.from === 0) newCastling.bQ = false;
    }
    // Revoke rights if rook is captured
    if (move.to === 63) newCastling.wK = false;
    if (move.to === 56) newCastling.wQ = false;
    if (move.to === 7) newCastling.bK = false;
    if (move.to === 0) newCastling.bQ = false;

    return {
        board: newBoard,
        turn: getOpponent(state.turn),
        castling: newCastling,
        enPassantTarget,
        halfMoves,
        fullMoves: state.turn === 'b' ? state.fullMoves + 1 : state.fullMoves
    };
};

/**
 * Returns only fully legal moves (filters out moves that leave king in check).
 */
export const getLegalMoves = (state: GameState): Move[] => {
    const pseudoMoves = getPseudoLegalMoves(state);
    
    return pseudoMoves.filter(move => {
        const nextState = makeMove(state, move);
        const kingIdx = nextState.board.findIndex(p => p?.type === 'k' && p?.color === state.turn);
        
        // If the king is under attack in the resulting position, the move is illegal
        return !isSquareAttacked(nextState, kingIdx, nextState.turn); 
    });
};

export const getLegalMovesOf = (state: GameState, squareIndex: number): Move[] => {
    return getLegalMoves(state).filter(move => move.from === squareIndex);
}

// --- GAME END CONDITIONS ---

export const isCheck = (state: GameState): boolean => {
    const kingIdx = state.board.findIndex(p => p?.type === 'k' && p?.color === state.turn);
    return isSquareAttacked(state, kingIdx, getOpponent(state.turn));
};

export const isCheckmate = (state: GameState): boolean => {
    return isCheck(state) && getLegalMoves(state).length === 0;
};

export const isStalemate = (state: GameState): boolean => {
    return !isCheck(state) && getLegalMoves(state).length === 0;
};