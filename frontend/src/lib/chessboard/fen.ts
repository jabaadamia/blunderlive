import { GameState, Board, Piece, Color, PieceType, CastlingRights } from './types';
import { createEmptyBoard } from './moveGen';

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const parseFen = (fen: string): GameState => {
    const [pieces, turn, castling, enPassant, halfMoves, fullMoves] = fen.split(' ');
    const board: Board = createEmptyBoard();
    
    let index = 0;
    for (const char of pieces) {
        if (char === '/') continue;
        if (/\d/.test(char)) {
            index += parseInt(char, 10);
        } else {
            const color: Color = char === char.toUpperCase() ? 'w' : 'b';
            const type = char.toLowerCase() as PieceType;
            board[index] = { type, color };
            index++;
        }
    }

    // Convert algebraic en passant (e.g 'e3') to our 0-63 index
    let enPassantTarget: number | null = null;
    if (enPassant !== '-') {
        const file = enPassant.charCodeAt(0) - 'a'.charCodeAt(0);;
        const rank = 8 - parseInt(enPassant[1], 10);
        enPassantTarget = rank * 8 + file;
    }

    return {
        board,
        turn: turn as Color,
        castling: {
            wK: castling.includes('K'),
            wQ: castling.includes('Q'),
            bK: castling.includes('k'),
            bQ: castling.includes('q')
        },
        enPassantTarget,
        halfMoves: parseInt(halfMoves, 10),
        fullMoves: parseInt(fullMoves, 10)
    };
};

export const stateToFen = (state: GameState): string => {
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let emptyCount = 0;
        for (let c = 0; c < 8; c++) {
            const piece = state.board[r * 8 + c];
            if (!piece) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                const char = piece.type;
                fen += piece.color === 'w' ? char.toUpperCase() : char;
            }
        }
        if (emptyCount > 0) fen += emptyCount;
        if (r < 7) fen += '/';
    }

    const turn = state.turn;
    
    let castling = '';
    if (state.castling.wK) castling += 'K';
    if (state.castling.wQ) castling += 'Q';
    if (state.castling.bK) castling += 'k';
    if (state.castling.bQ) castling += 'q';
    if (castling === '') castling = '-';

    let ep = '-';
    if (state.enPassantTarget !== null) {
        const r = Math.floor(state.enPassantTarget / 8);
        const c = state.enPassantTarget % 8;
        ep = String.fromCharCode(97 + c) + (8 - r).toString();
    }

    return `${fen} ${turn} ${castling} ${ep} ${state.halfMoves} ${state.fullMoves}`;
};