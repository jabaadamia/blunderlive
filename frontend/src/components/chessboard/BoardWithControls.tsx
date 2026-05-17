'use client';
import { useMemo, useRef, useState } from 'react';
import Board from '@/components/chessboard/Board';
import ControlBar from './ControlBar';
import { parseFen } from '@/lib/chessboard/fen';
import { indexToCoord } from '@/lib/chessboard/coords';
import { getLegalMovesOf, makeMove } from '@/lib/chessboard/moveGen';
import type { PieceType } from '@/lib/chessboard/types';
import PromotionPicker from './PromotionPicker';
import { INITIAL_FEN } from '@/lib/chessboard/fen';
import PGNViewer from '../PGN/PGNviewer';


interface BoardWithControlsProps {
  fen?: string;
  orientation?: 'white' | 'black';
  controlBar?: boolean;
  pgnViewer?: boolean;
  /** Server or PGN move list (e.g. UCI strings). When omitted, local play appends each move here. */
  moves?: string[];
  /** When set, completed moves call this with UCI; position updates come from `fen` (server‑authoritative). */
  onMove?: (uci: string) => void;
  /** When `onMove` is set, disables input (e.g. opponent’s turn). */
  interactionEnabled?: boolean;
}

export default function BoardWithControls({
  fen = INITIAL_FEN,
  orientation = 'white',
  controlBar = true,
  pgnViewer = true,
  moves: movesProp,
  onMove,
  interactionEnabled = true,
}: BoardWithControlsProps) {
  const isControlled = typeof onMove === 'function';
  const controlledGameState = useMemo(() => parseFen(fen), [fen]);
  const [uncontrolledGameState, setUncontrolledGameState] = useState(() => parseFen(fen));
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(orientation);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(null);
  const [localMoves, setLocalMoves] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const boardGridRef = useRef<HTMLDivElement | null>(null);
  const gameState = isControlled ? controlledGameState : uncontrolledGameState;

  const displayMoves = movesProp !== undefined ? movesProp : localMoves;

  const activeColor = gameState.turn; // 'w' | 'b'
  const canInteract = !isControlled || interactionEnabled;

  function applyMove(from: number, to: number, promotion?: PieceType) {
    const uci = indexToCoord(from) + indexToCoord(to) + (promotion ?? '');
    if (isControlled && onMove) {
      onMove(uci);
    } else {
      setUncontrolledGameState((g) => makeMove(g, { from, to, promotion }));
      setLocalMoves((m) => [...m, uci]);
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function isPromotion(from: number, to: number): boolean {
    const piece = gameState.board[from];
    if (!piece || piece.type !== 'p') return false;
    const toRank = 8 - Math.floor(to / 8); // 1-8
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
  }
 
  /** Select a square: compute highlights, or deselect if already selected */
  function selectSquare(index: number) {
    if (selectedIndex === index) {
      // clicking the same square deselects
      setSelectedIndex(null);
      setHighlightIndices([]);
      return;
    }
    setSelectedIndex(index);
    setHighlightIndices(getLegalMovesOf(gameState, index).map(m => m.to));
  }
 
  function clearSelection() {
    setSelectedIndex(null);
    setHighlightIndices([]);
  }
 
  // ── interaction handlers ──────────────────────────────────────────────────
 
  function handlePromotionPick(piece: 'q' | 'r' | 'b' | 'n') {
    if (!pendingPromotion) return;
    applyMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
    clearSelection();
  }

  function handlePromotionCancel() {
    setPendingPromotion(null);
    clearSelection();
  }

  function handleSquareClick(index: number) {
    if (isControlled && !canInteract) {
      clearSelection();
      return;
    }

    const piece = gameState.board[index];

    if (selectedIndex !== null) {
      if (highlightIndices.includes(index)) {
        if (isPromotion(selectedIndex, index)) {
          setPendingPromotion({ from: selectedIndex, to: index });
          return;
        }
        applyMove(selectedIndex, index);
        clearSelection();
        return;
      }
      // Clicked a different own piece -> re-select
      if (piece && piece.color === activeColor) {
        selectSquare(index);
        return;
      }
      // Clicked empty or opponent square that isn't a legal target -> deselect
      clearSelection();
      return;
    }
 
    // Nothing selected yet, only select own pieces
    if (piece && piece.color === activeColor) {
      selectSquare(index);
    }
  }
 
  function handleDragStart(index: number) {
    if (isControlled && !canInteract) return;
    const piece = gameState.board[index];
    if (!piece || piece.color !== activeColor) return;
    // If this piece is already selected, keep highlights (selectSquare would toggle off).
    if (selectedIndex === index) return;
    selectSquare(index);
  }

  function handleDragEnd(fromIndex: number, toIndex: number | null) {
    if (isControlled && !canInteract) {
      clearSelection();
      return;
    }
    if (toIndex !== null && highlightIndices.includes(toIndex)) {
      if (isPromotion(fromIndex, toIndex)) {
        setPendingPromotion({ from: fromIndex, to: toIndex });
        return;
      }
      applyMove(fromIndex, toIndex);
    }
    clearSelection();
  }
 
  return (
    <div className="flex gap-4 w-full h-full">
      {/* Left column: board + control bar */}
      <div className="flex flex-col min-w-0 flex-1 max-w-[min(100%,calc(100vh-4rem))]">
        <Board
          board={gameState.board}
          orientation={boardOrientation}
          activeColor={activeColor}
          selectedIndex={selectedIndex}
          highlightIndices={highlightIndices}
          gridRef={boardGridRef}
          onSquareClick={handleSquareClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
        {pendingPromotion && (
          <PromotionPicker
            toIndex={pendingPromotion.to}
            color={gameState.turn}
            orientation={boardOrientation}
            boardRef={boardGridRef}
            onPick={handlePromotionPick}
            onCancel={handlePromotionCancel}
          />
        )}
 
        {controlBar && (
          <div className="mt-2 shrink-0">
            <ControlBar onFlipBoard={() => setBoardOrientation(p => p === 'white' ? 'black' : 'white')} />
          </div>
        )}
      </div>
 
      {pgnViewer && (
        <PGNViewer
          moves={displayMoves}
          currentPly={currentPly}
          onSelectPly={(ply) => {
            setCurrentPly(ply);

            // TODO:
            // reconstruct board from initial position + moves.slice(0, ply)
            // then setGameState(reconstructedState)
          }}
        />
      )}
    </div>
  );
}
