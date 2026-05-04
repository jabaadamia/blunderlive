export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
    type: PieceType;
    color: Color;
}

export type Square = Piece | null;
export type Board = Square[];

export interface CastlingRights {
    wK: boolean; wQ: boolean; bK: boolean; bQ: boolean;
}

export interface GameState {
    board: Board;
    turn: Color;
    castling: CastlingRights;
    enPassantTarget: number | null;
    halfMoves: number;
    fullMoves: number;
}

export interface Move {
    from: number;
    to: number;
    promotion?: PieceType;
}