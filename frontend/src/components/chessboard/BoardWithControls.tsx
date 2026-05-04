'use client';
import { useRef, useState } from 'react';
import Board from '@/components/chessboard/Board';
import ControlBar from './ControlBar';
import { parseFen } from '@/lib/chessboard/fen';
import { getLegalMovesOf, makeMove } from '@/lib/chessboard/moveGen';
import { SquareCoord } from '@/lib/chessboard/coords';
import PromotionPicker from './PromotionPicker';
 
const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 
interface BoardWithControlsProps {
  fen?: string;
  orientation?: 'white' | 'black';
  controlBar?: boolean;
  pgnViewer?: boolean;
}
 
export default function BoardWithControls({
  fen = initialFen,
  orientation = 'white',
  controlBar = true,
  pgnViewer = true,
}: BoardWithControlsProps) { 
 
  const [gameState, setGameState] = useState(() => parseFen(fen));
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(orientation);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(null);
  const boardGridRef = useRef<HTMLDivElement | null>(null);
 
  const activeColor = gameState.turn; // 'w' | 'b'

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
    const newGameState = makeMove(gameState, { ...pendingPromotion, promotion: piece });
    setGameState(newGameState);
    setPendingPromotion(null);
    clearSelection();
  }

  function handlePromotionCancel() {
    setPendingPromotion(null);
    clearSelection();
  }

  function handleSquareClick(index: number) {
    const piece = gameState.board[index];
 
    if (selectedIndex !== null) {
      if (highlightIndices.includes(index)) {
        if (isPromotion(selectedIndex, index)) {
          setPendingPromotion({ from: selectedIndex, to: index });
          return;
        }
        const newGameState = makeMove(gameState, { from: selectedIndex, to: index });
        setGameState(newGameState);
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
    // Drag counts as an immediate selection
    selectSquare(index);
  }
 
  function handleDragEnd(fromIndex: number, toIndex: number | null) {
    if (toIndex !== null && highlightIndices.includes(toIndex)) {
      if (isPromotion(fromIndex, toIndex)) {
        setPendingPromotion({ from: fromIndex, to: toIndex });
        return;
      }
      const newGameState = makeMove(gameState, {from: fromIndex, to: toIndex});
      setGameState(newGameState); 
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
 
      {/* Right column: PGN viewer */}
      {pgnViewer && (
        <div className="w-64 shrink-0 border border-border rounded p-2 overflow-y-auto">
          PGN Viewer Placeholder
        </div>
      )}
    </div>
  );
}
 