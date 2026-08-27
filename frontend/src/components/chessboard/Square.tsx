'use client';
import { Square as SquareType } from '@/lib/chessboard/types';
import PieceComponent from './Piece';
 
interface SquareProps {
  square: string;
  squareIndex: number;
  piece: SquareType;
  isDark: boolean;
  rankLabel?: string;
  fileLabel?: string;
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
  rankLabel,
  fileLabel,
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
        'relative flex items-center justify-center w-full h-full @container',
        isDark ? 'bg-dark-square' : 'bg-light-square',
        isSelected ? 'bg-selected-piece-bg' : '',
        // Only show pointer cursor when there's an interactive piece OR it's a legal target
        isInteractive && hasPiece ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      ].join(' ')}
    >
      {rankLabel ? (
        <span
          className={[
            'pointer-events-none absolute left-px top-px select-none text-[10px] font-semibold sm:text-xs',
            isDark ? 'text-light-square/90' : 'text-dark-square/80',
          ].join(' ')}
        >
          {rankLabel}
        </span>
      ) : null}

      {fileLabel ? (
        <span
          className={[
            'pointer-events-none absolute bottom-px right-px select-none text-[10px] font-semibold lowercase sm:text-xs',
            isDark ? 'text-light-square/90' : 'text-dark-square/80',
          ].join(' ')}
        >
          {fileLabel}
        </span>
      ) : null}

      {/* Legal move dot / capture target */}
      {isHighlighted && (
        hasPiece
          ?
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Top Left */}
              <div className="absolute top-0 left-0 w-[19cqw] h-[19cqw] border-t-[6cqw] border-l-[6cqw] border-attacked-piece-bg" />
              {/* Top Right */}
              <div className="absolute top-0 right-0 w-[19cqw] h-[19cqw] border-t-[6cqw] border-r-[6cqw] border-attacked-piece-bg" />
              {/* Bottom Left */}
              <div className="absolute bottom-0 left-0 w-[19cqw] h-[19cqw] border-b-[6cqw] border-l-[6cqw] border-attacked-piece-bg" />
              {/* Bottom Right */}
              <div className="absolute bottom-0 right-0 w-[19cqw] h-[19cqw] border-b-[6cqw] border-r-[6cqw] border-attacked-piece-bg" />
            </div>
          :
            <div className="absolute w-[32%] h-[32%] rounded-full bg-legal-move-circle-bg pointer-events-none z-10" />
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
