'use client';
import { Square as SquareType } from '@/lib/chessboard/types';
import PieceComponent from './Piece';
 
interface SquareProps {
  square: string;
  squareIndex: number;
  piece: SquareType;
  isDark: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDragging?: boolean;       // true when THIS square's piece is being ghost-dragged
  isInteractive?: boolean;    // false for opponent pieces on their turn
  onClick?: (square: string) => void;
  onPieceDragStart?: (e: React.PointerEvent, index: number) => void;
}
 
export default function Square({
  square,
  squareIndex,
  piece,
  isDark,
  isSelected,
  isHighlighted,
  isDragging,
  isInteractive = true,
  onClick,
  onPieceDragStart,
}: SquareProps) {
  const hasPiece = piece != null;
 
  return (
    <div
      onClick={() => onClick?.(square)}
      className={[
        'relative flex items-center justify-center w-full h-full',
        isDark ? 'bg-cyan-800' : 'bg-cyan-100',
        isSelected ? 'ring-4 ring-inset ring-yellow-400' : '',
        // Only show pointer cursor when there's an interactive piece OR it's a legal target
        isInteractive && hasPiece ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      ].join(' ')}
    >
      {/* Legal move dot / capture ring. TODO: change styling */}
      {isHighlighted && (
        hasPiece
          ?
            <div className="absolute inset-0 ring-4 ring-inset ring-black/30 rounded-sm pointer-events-none z-10" />
          :
            <div className="absolute w-[32%] h-[32%] rounded-full bg-black/25 pointer-events-none z-10" />
      )}
 
      {hasPiece && (
        <div
          className={[
            'relative w-full h-full select-none',
            isDragging ? 'opacity-0' : 'opacity-100',
            isInteractive ? 'touch-none' : 'pointer-events-none',
          ].join(' ')}
          onPointerDown={
            isInteractive
              ? (e) => onPieceDragStart?.(e, squareIndex)
              : undefined
          }
        >
          <PieceComponent piece={piece} />
        </div>
      )}
    </div>
  );
}