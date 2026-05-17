'use client';
import { useRef } from 'react';
import { Board as BoardType, Piece } from '@/lib/chessboard/types';
import Square from './Square';
import DragGhost from './DragGhost';
import { useDragPiece } from './useDragPiece';
import { FILES, RANKS, coordToIndex, SquareCoord } from '@/lib/chessboard/coords';
 
interface BoardProps {
  board: BoardType;
  /** Index (0-63) of the currently selected square, controlled by parent */
  selectedIndex?: number | null;
  /** Indices (0-63) that should be highlighted as legal moves */
  highlightIndices?: number[];
  /** Reference to the board grid container */
  gridRef?: React.RefObject<HTMLDivElement | null>;
  /** Called when any square is clicked — parent decides what to do */
  onSquareClick?: (index: number, square: SquareCoord) => void;
  /** Called when a drag starts — parent selects the piece */
  onDragStart?: (index: number) => void;
  /** Called when a drag ends — parent handles the move */
  onDragEnd?: (fromIndex: number, toIndex: number | null) => void;
  /** Color whose pieces are interactive this turn ('w' | 'b') */
  activeColor?: 'w' | 'b';
  orientation?: 'white' | 'black';
  className?: string;
}

export default function Board({
  board,
  selectedIndex = null,
  highlightIndices = [],
  gridRef,
  onSquareClick,
  onDragStart,
  onDragEnd,
  activeColor,
  orientation = 'white',
  className,
}: BoardProps) {
  const boardGridRef = useRef<HTMLDivElement>(null);
 
  const displayRanks = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];
  const displayFiles = orientation === 'white' ? [...FILES] : [...FILES].reverse();
 
  const { drag, startDrag, moveDrag, endDrag, ghostRef } = useDragPiece({
    boardRef: boardGridRef,
    onDragStart,
    onDragEnd,
    orientation,
  });
 
  const draggedPiece: Piece | null =
    drag != null ? (board[drag.index] as Piece | null) : null;
 
  return (
    <div
      className={`w-full aspect-square flex flex-col ${className ?? ''}`}
      onPointerMove={drag ? moveDrag : undefined}
      onPointerUp={drag ? endDrag : undefined}
    >
      <div className="flex flex-1 min-h-0">
        {/* Rank labels */}
        <div className="flex flex-col w-5 shrink-0 select-none">
          {displayRanks.map((rank) => (
            <div
              key={rank}
              className="flex-1 flex items-center justify-center text-xs text-muted-foreground font-medium"
            >
              {rank}
            </div>
          ))}
        </div>
 
        {/* Board grid + file labels */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            ref={(el) => {
              (boardGridRef as React.RefObject<HTMLDivElement | null>).current = el;
              if (gridRef) gridRef.current = el;
            }}
            className="grid grid-cols-8 grid-rows-8 flex-1 border border-border"
          >
            {displayRanks.map((rank) =>
              displayFiles.map((file) => {
                const square = `${file}${rank}` as SquareCoord;
                const index = coordToIndex(square);
                const fileIdx = FILES.indexOf(file);
                const rankIdx = rank - 1;
                const isDark = (fileIdx + rankIdx) % 2 === 0;
                const piece = board[index] as Piece | null;
 
                const isInteractive =
                  piece != null && activeColor != null
                    ? piece.color === activeColor
                    : piece != null;
 
                return (
                  <Square
                    key={square}
                    square={square}
                    squareIndex={index}
                    piece={piece}
                    isDark={isDark}
                    isSelected={selectedIndex === index}
                    isHighlighted={highlightIndices.includes(index)}
                    isDragging={drag?.index === index}
                    isInteractive={isInteractive}
                    onClick={() => onSquareClick?.(index, square)}
                    onPieceDragStart={startDrag}
                  />
                );
              })
            )}
          </div>
 
          {/* File labels */}
          <div className="grid grid-cols-8 h-5 shrink-0 select-none">
            {displayFiles.map((file) => (
              <div
                key={file}
                className="flex items-center justify-center text-xs text-muted-foreground font-medium"
              >
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>
 
      {drag && draggedPiece && <DragGhost drag={drag} piece={draggedPiece} ghostRef={ghostRef} />}
    </div>
  );
}
 