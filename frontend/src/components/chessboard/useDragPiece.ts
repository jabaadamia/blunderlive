'use client';
import { useCallback, useRef, useState } from 'react';
 
export interface DragState {
  index: number;
  size: number;
  x: number;
  y: number;
}

export const dragPosRef = { current: { x: 0, y: 0 } };
 
interface UseDragPieceOptions {
  onDragStart?: (index: number) => void;
  onDragEnd?: (fromIndex: number, targetIndex: number | null) => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
  cols?: number;
  orientation?: 'white' | 'black';
}
 
export function useDragPiece({
  onDragStart,
  onDragEnd,
  boardRef,
  cols = 8,
  orientation = 'white',
}: UseDragPieceOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent, squareIndex: number) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
 
      const board = boardRef.current;
      const squareSize = board ? board.getBoundingClientRect().width / cols : 64;
 
      const state: DragState = {
        index: squareIndex,
        x: e.clientX,
        y: e.clientY,
        size: squareSize,
      };
      dragRef.current = state;
      setDrag({ ...state });
      onDragStart?.(squareIndex);
    },
    [boardRef, cols, orientation, onDragStart],
  );
 
  const moveDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragPosRef.current = { x: e.clientX, y: e.clientY };
    // directly mutate the ghost DOM node
    if (ghostRef.current) {
      const half = dragRef.current.size / 2;
      ghostRef.current.style.left = `${e.clientX - half}px`;
      ghostRef.current.style.top = `${e.clientY - half}px`;
    }
  }, []);
 
  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
 
      let targetIndex: number | null = null;
      const board = boardRef.current;
      if (board) {
        const rect = board.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        const sqW = rect.width / cols;
        const sqH = rect.height / cols;
        const col = Math.floor(relX / sqW);
        const row = Math.floor(relY / sqH);
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
          targetIndex = row * 8 + col;
        }
      }
      if (orientation === 'black' && targetIndex !== null) {
        // Flip the index for black orientation
        const flippedRow = 7 - Math.floor(targetIndex / 8);
        const flippedCol = 7 - (targetIndex % 8);
        targetIndex = flippedRow * 8 + flippedCol;
      }
      dragRef.current = null;
      setDrag(null);
      onDragEnd?.(current.index, targetIndex);
    },
    [boardRef, cols, orientation, onDragEnd],
  );
 
  return { drag, startDrag, moveDrag, endDrag, ghostRef };
}
 