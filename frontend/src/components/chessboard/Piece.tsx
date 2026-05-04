import Image from 'next/image';
import { Piece as PieceType, PieceType as PieceLetter } from '@/lib/chessboard/types';

interface PieceProps {
  piece: PieceType;
}

const pieceNames: Record<PieceLetter, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king'
};

const pieceAsset = (piece: PieceType) =>
  `/assets/chess/pieces/${piece.color == 'w' ? 'white' : 'black'}${pieceNames[piece.type]}.svg`; // TODO: maybe rename files to just 'bp', 'wk'...

export default function Piece({ piece }: PieceProps) {
  return (
    <Image
      src={pieceAsset(piece)}
      alt={`${piece.color} ${piece.type}`}
      fill
      sizes="64px"
      loading="eager"
      priority
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  );
}