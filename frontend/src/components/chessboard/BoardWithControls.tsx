'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildMoveHistory } from '@/lib/chessboard/history';
import { INITIAL_FEN, parseFen } from '@/lib/chessboard/fen';
import { indexToCoord } from '@/lib/chessboard/coords';
import { getLegalMovesOf, makeMove } from '@/lib/chessboard/moveGen';
import type { PieceType } from '@/lib/chessboard/types';

import Board from './Board';
import ControlBar from './ControlBar';
import PGNViewer from '../PGN/PGNViewer';
import PromotionPicker from './PromotionPicker';
import DrawResignBar from './DrawResignBar';

interface BoardWithControlsProps {
  fen?: string;
  initialFen?: string;
  orientation?: 'white' | 'black';
  controlBar?: boolean;
  pgnViewer?: boolean;
  moves?: string[];
  onMove?: (uci: string) => void;
  interactionEnabled?: boolean;
  forLiveGame?: boolean;
  onDrawOffer?: () => void;
  onDrawAccept?: () => void;
  onDrawDecline?: () => void;
  onResign?: () => void;
  canOfferDraw?: boolean;
  canResign?: boolean;
  hasIncomingDrawOffer?: boolean;
  hasOutgoingDrawOffer?: boolean;
  actionPending?: boolean;
}

export default function BoardWithControls({
  fen = INITIAL_FEN,
  initialFen = INITIAL_FEN,
  orientation = 'white',
  controlBar = true,
  pgnViewer = true,
  moves: movesProp,
  onMove,
  interactionEnabled = true,
  forLiveGame = false,
  onDrawOffer,
  onDrawAccept,
  onDrawDecline,
  onResign,
  canOfferDraw = true,
  canResign = true,
  hasIncomingDrawOffer = false,
  hasOutgoingDrawOffer = false,
  actionPending = false,
}: BoardWithControlsProps) {
  const isControlled = typeof onMove === 'function';
  const controlledGameState = useMemo(() => parseFen(fen), [fen]);
  const initialGameState = useMemo(() => parseFen(initialFen), [initialFen]);
  const [uncontrolledGameState, setUncontrolledGameState] = useState(() => initialGameState);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(orientation);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(
    null,
  );
  const [localMoves, setLocalMoves] = useState<string[]>([]);
  const [reviewPly, setReviewPly] = useState(0);
  const [isFollowingLatest, setIsFollowingLatest] = useState(true);
  const boardGridRef = useRef<HTMLDivElement | null>(null);

  const latestGameState = isControlled ? controlledGameState : uncontrolledGameState;
  const displayMoves = movesProp !== undefined ? movesProp : localMoves;
  const moveHistory = useMemo(
    () => buildMoveHistory(displayMoves, initialFen),
    [displayMoves, initialFen],
  );
  const totalPly = moveHistory.length;
  const currentPly = isFollowingLatest ? totalPly : Math.min(reviewPly, totalPly);

  const gameState = useMemo(() => {
    if (currentPly === totalPly) {
      return latestGameState;
    }

    if (currentPly === 0) {
      return initialGameState;
    }

    return moveHistory[currentPly - 1]?.state ?? latestGameState;
  }, [currentPly, initialGameState, latestGameState, moveHistory, totalPly]);

  const activeColor = gameState.turn;
  const canInteract =
    currentPly === totalPly && isFollowingLatest && (!isControlled || interactionEnabled);

  const clearSelection = useCallback(() => {
    setSelectedIndex(null);
    setHighlightIndices([]);
  }, []);

  const clearTransientUi = useCallback(() => {
    clearSelection();
    setPendingPromotion(null);
  }, [clearSelection]);

  const navigateToPly = useCallback((ply: number) => {
    const nextPly = Math.max(0, Math.min(ply, totalPly));
    clearTransientUi();
    setReviewPly(nextPly);
    setIsFollowingLatest(nextPly === totalPly);
  }, [clearTransientUi, totalPly]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isEditable) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToPly(currentPly - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToPly(currentPly + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        navigateToPly(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        navigateToPly(totalPly);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPly, navigateToPly, totalPly]);

  function applyMove(from: number, to: number, promotion?: PieceType) {
    const uci = indexToCoord(from) + indexToCoord(to) + (promotion ?? '');
    setIsFollowingLatest(true);

    if (isControlled && onMove) {
      onMove(uci);
      return;
    }

    setUncontrolledGameState((state) => makeMove(state, { from, to, promotion }));
    setLocalMoves((moves) => [...moves, uci]);
  }

  function isPromotion(from: number, to: number): boolean {
    const piece = gameState.board[from];

    if (!piece || piece.type !== 'p') {
      return false;
    }

    const toRank = 8 - Math.floor(to / 8);
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
  }

  function selectSquare(index: number) {
    if (selectedIndex === index) {
      clearSelection();
      return;
    }

    setSelectedIndex(index);
    setHighlightIndices(getLegalMovesOf(gameState, index).map((move) => move.to));
  }

  function handlePromotionPick(piece: 'q' | 'r' | 'b' | 'n') {
    if (!pendingPromotion) {
      return;
    }

    applyMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
    clearSelection();
  }

  function handlePromotionCancel() {
    setPendingPromotion(null);
    clearSelection();
  }

  function handleSquareClick(index: number) {
    if (!canInteract) {
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

      if (piece && piece.color === activeColor) {
        selectSquare(index);
        return;
      }

      clearSelection();
      return;
    }

    if (piece && piece.color === activeColor) {
      selectSquare(index);
    }
  }

  function handleDragStart(index: number) {
    if (!canInteract) {
      return;
    }

    const piece = gameState.board[index];

    if (!piece || piece.color !== activeColor) {
      return;
    }

    if (selectedIndex === index) {
      return;
    }

    selectSquare(index);
  }

  function handleDragEnd(fromIndex: number, toIndex: number | null) {
    if (!canInteract) {
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
    <div className="flex h-full w-full flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col gap-3 xl:min-h-0">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] xl:max-w-[min(100%,calc(100vh-11rem))]">
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
        </div>

        {pendingPromotion ? (
          <PromotionPicker
            toIndex={pendingPromotion.to}
            color={gameState.turn}
            orientation={boardOrientation}
            boardRef={boardGridRef}
            onPick={handlePromotionPick}
            onCancel={handlePromotionCancel}
          />
        ) : null}

      </div>

      <div className="flex min-w-0 flex-col gap-3 xl:h-full xl:min-h-0">
        {controlBar ? (
          <div className="order-1 xl:order-2">
            <ControlBar
              canGoToFirst={currentPly > 0}
              canGoToPrevious={currentPly > 0}
              canGoToNext={currentPly < totalPly}
              canGoToLast={currentPly < totalPly}
              onFirstMove={() => navigateToPly(0)}
              onPreviousMove={() => navigateToPly(currentPly - 1)}
              onNextMove={() => navigateToPly(currentPly + 1)}
              onLastMove={() => navigateToPly(totalPly)}
              onFlipBoard={() =>
                setBoardOrientation((value) => (value === 'white' ? 'black' : 'white'))
              }
            />
          </div>
        ) : null}
      
        {forLiveGame ? (
          <div className="order-2 xl:order-3">
            <DrawResignBar
              canOfferDraw={canOfferDraw}
              canResign={canResign}
              hasIncomingDrawOffer={hasIncomingDrawOffer}
              hasOutgoingDrawOffer={hasOutgoingDrawOffer}
              actionPending={actionPending}
              onDrawOffer={onDrawOffer}
              onDrawAccept={onDrawAccept}
              onDrawDecline={onDrawDecline}
              onResign={onResign}
            />
          </div>
        ) : null}

        {pgnViewer ? (
          <div className="order-3 mx-auto w-full max-w-[20rem] xl:order-1 xl:mx-0 xl:min-h-0 xl:max-w-[20rem] xl:flex-1">
            <PGNViewer
              entries={moveHistory}
              currentPly={currentPly}
              onSelectPly={navigateToPly}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
