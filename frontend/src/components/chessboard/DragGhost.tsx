'use client';
import { createPortal } from 'react-dom';
import { DragState } from './useDragPiece';
import { Piece as PieceType } from '@/lib/chessboard/types';
import PieceComponent from './Piece';
 
interface DragGhostProps {
  drag: DragState;
  piece: PieceType;
  ghostRef: React.RefObject<HTMLDivElement | null>;
}
 
/**
 * Renders the dragged piece centered on the cursor, in a portal
 * so it escapes any overflow:hidden containers.
 */
export default function DragGhost({ drag, piece, ghostRef }: DragGhostProps) {
 
  const half = drag.size / 2;
 
  return createPortal(
    <div
      ref={ghostRef}
      className="fixed pointer-events-none z-9999 select-none"
      style={{
        left: drag.x - half,
        top: drag.y - half,
        width: drag.size,
        height: drag.size,
        transform: 'scale(1.08)',
        transformOrigin: 'center',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.45))',
      }}
    >
      <div className="relative w-full h-full">
        <PieceComponent piece={piece} />
      </div>
    </div>,
    document.body,
  );
}