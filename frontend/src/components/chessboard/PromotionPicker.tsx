'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import PieceComponent from './Piece';

const PROMOTION_PIECES = ['q', 'r', 'b', 'n'] as const;
type PromoPiece = typeof PROMOTION_PIECES[number];

interface Props {
  toIndex: number;
  color: 'w' | 'b';
  orientation: 'white' | 'black';
  boardRef: React.RefObject<HTMLDivElement | null>;
  onPick: (piece: PromoPiece) => void;
  onCancel: () => void;
}

export default function PromotionPicker({ toIndex, color, orientation, boardRef, onPick, onCancel }: Props) {
  const [position, setPosition] = useState<{ left: number; top: number; size: number } | null>(null);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const sqSize = rect.width / 8;
    const file = toIndex % 8;
    const displayCol = orientation === 'white' ? file : 7 - file;
    const stacksDown = color === 'w' ? orientation === 'white' : orientation === 'black';
    setPosition({
      left: rect.left + displayCol * sqSize,
      top: stacksDown ? rect.top : rect.top + rect.height - sqSize * 4,
      size: sqSize,
    });
  }, [boardRef, toIndex, color, orientation]);

  if (!position) return null;

  const stacksDown = color === 'w' ? orientation === 'white' : orientation === 'black';
  const pieces = stacksDown ? PROMOTION_PIECES : [...PROMOTION_PIECES].reverse();

  return createPortal(
    <>
      <div className="fixed inset-0 z-9998" onPointerDown={onCancel} />
      <div
        className="fixed z-9999 flex flex-col rounded overflow-hidden border border-border"
        style={{ left: position.left, top: position.top, width: position.size, height: position.size * 4 }}
      >
        {pieces.map((p) => (
          <button
            key={p}
            className="flex-1 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 transition-colors"
            onPointerDown={(e) => { e.stopPropagation(); onPick(p); }}
          >
            <div className="relative w-full h-full">
              <PieceComponent piece={{ type: p, color }} />
            </div>
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}