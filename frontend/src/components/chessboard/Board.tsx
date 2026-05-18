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
      className={`flex aspect-square w-full flex-col ${className ?? ''}`}
      onPointerMove={drag ? moveDrag : undefined}
      onPointerUp={drag ? endDrag : undefined}
    >
      <div
        ref={(el) => {
          (boardGridRef as React.RefObject<HTMLDivElement | null>).current = el;
          if (gridRef) gridRef.current = el;
        }}
        className="grid flex-1 grid-cols-8 grid-rows-8 overflow-hidden border border-border"
      >
        {displayRanks.map((rank, rankIndex) =>
          displayFiles.map((file, fileIndex) => {
            const square = `${file}${rank}` as SquareCoord;
            const index = coordToIndex(square);
            const boardFileIndex = FILES.indexOf(file);
            const boardRankIndex = rank - 1;
            const isDark = (boardFileIndex + boardRankIndex) % 2 === 0;
            const piece = board[index] as Piece | null;

            const isInteractive =
              piece != null && activeColor != null
                ? piece.color === activeColor
                : piece != null;

            const showRankLabel = fileIndex === 0;
            const showFileLabel = rankIndex === displayRanks.length - 1;

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
                rankLabel={showRankLabel ? String(rank) : undefined}
                fileLabel={showFileLabel ? file : undefined}
                onClick={() => onSquareClick?.(index, square)}
                onPieceDragStart={startDrag}
              />
            );
          }),
        )}
      </div>

      {drag && draggedPiece && <DragGhost drag={drag} piece={draggedPiece} ghostRef={ghostRef} />}
    </div>
  );
}
 
