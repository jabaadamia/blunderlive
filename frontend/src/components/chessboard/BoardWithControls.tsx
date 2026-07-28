'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  addMoveToTree,
  buildLinearMoveTree,
  buildMoveHistory,
  getActiveLine,
  getPathToNode,
  ROOT_NODE_ID,
  type MoveHistoryEntry,
  type MoveTree,
} from '@/lib/chessboard/history';
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
  topPlayerElement?: React.ReactNode;
  bottomPlayerElement?: React.ReactNode;
  gameStatusElement?: React.ReactNode;
  customMoveHistory?: MoveHistoryEntry[];
  onPlyChange?: (ply: number) => void;
  // Tree/editable-PGN mode. When provided, the board becomes interactive
  // over the whole tree: playing a move away from the tip creates a new
  // variation (or transposes into an existing one) instead of appending
  // to a flat move list.
  moveTree?: MoveTree;
  onNodeChange?: (nodeId: string) => void;
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
  topPlayerElement,
  bottomPlayerElement,
  gameStatusElement,
  customMoveHistory,
  onPlyChange,
  moveTree,
  onNodeChange,
}: BoardWithControlsProps) {
  const isControlled = typeof onMove === 'function';
  const usingTreeMode = moveTree !== undefined;

  const controlledGameState = useMemo(() => parseFen(fen), [fen]);
  const initialGameState = useMemo(() => parseFen(initialFen), [initialFen]);
  const [uncontrolledGameState, setUncontrolledGameState] = useState(() => initialGameState);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(orientation);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(
    null,
  );
  const boardGridRef = useRef<HTMLDivElement | null>(null);

  // --- flat/live-play state (used when moveTree is not provided) ---
  const [localMoves, setLocalMoves] = useState<string[]>([]);
  const [reviewPly, setReviewPly] = useState(0);
  const [isFollowingLatest, setIsFollowingLatest] = useState(true);

  // --- tree state (used when moveTree is provided) ---
  const [editableTree, setEditableTree] = useState<MoveTree | null>(() => moveTree ?? null);
  const [currentNodeId, setCurrentNodeId] = useState(ROOT_NODE_ID);

  // Reseed if the parent hands us a genuinely new tree (new PGN loaded).
  useEffect(() => {
    if (moveTree) {
      setEditableTree(moveTree);
      setCurrentNodeId(ROOT_NODE_ID);
    }
  }, [moveTree]);

  const latestGameState = isControlled ? controlledGameState : uncontrolledGameState;
  const displayMoves = movesProp !== undefined ? movesProp : localMoves;

  const flatMoveHistory = useMemo(() => {
    if (usingTreeMode) return [];
    return customMoveHistory ?? buildMoveHistory(displayMoves, initialFen);
  }, [usingTreeMode, customMoveHistory, displayMoves, initialFen]);

  const moveHistory = usingTreeMode
    ? editableTree
      ? getActiveLine(editableTree, currentNodeId)
      : []
    : flatMoveHistory;

  const totalPly = moveHistory.length;

  const currentPly = usingTreeMode
    ? editableTree
      ? getPathToNode(editableTree, currentNodeId).length
      : 0
    : isFollowingLatest
      ? totalPly
      : Math.min(reviewPly, totalPly);

  useEffect(() => {
    onPlyChange?.(currentPly);
  }, [currentPly, onPlyChange]);

  useEffect(() => {
    if (usingTreeMode) onNodeChange?.(currentNodeId);
  }, [usingTreeMode, currentNodeId, onNodeChange]);

  const gameState = useMemo(() => {
    if (usingTreeMode) {
      return editableTree?.nodes[currentNodeId]?.state ?? initialGameState;
    }

    if (currentPly === totalPly) {
      if (isControlled) {
        return latestGameState;
      }
      if (totalPly > 0 && moveHistory[totalPly - 1]?.state) {
        return moveHistory[totalPly - 1].state;
      }
      return initialGameState;
    }

    if (currentPly === 0) {
      return initialGameState;
    }

    return moveHistory[currentPly - 1]?.state ?? latestGameState;
  }, [
    usingTreeMode,
    editableTree,
    currentNodeId,
    currentPly,
    initialGameState,
    isControlled,
    latestGameState,
    moveHistory,
    totalPly,
  ]);

  const activeColor = gameState.turn;
  const canInteract = usingTreeMode
    ? interactionEnabled
    : currentPly === totalPly && isFollowingLatest && (!isControlled || interactionEnabled);

  const clearSelection = useCallback(() => {
    setSelectedIndex(null);
    setHighlightIndices([]);
  }, []);

  const clearTransientUi = useCallback(() => {
    clearSelection();
    setPendingPromotion(null);
  }, [clearSelection]);

  const navigateToPly = useCallback(
    (ply: number) => {
      const nextPly = Math.max(0, Math.min(ply, totalPly));
      clearTransientUi();

      if (usingTreeMode) {
        const targetNode = nextPly > 0 ? moveHistory[nextPly - 1] : null;
        const nodeId: string =
          targetNode && 'id' in targetNode && typeof targetNode.id === 'string'
            ? targetNode.id
            : String(ROOT_NODE_ID);

        setCurrentNodeId(nodeId);
        return;
      }

      setReviewPly(nextPly);
      setIsFollowingLatest(nextPly === totalPly);
    },
    [clearTransientUi, moveHistory, totalPly, usingTreeMode],
  );

  const goToNode = useCallback(
    (nodeId: string) => {
      clearTransientUi();
      setCurrentNodeId(nodeId);
    },
    [clearTransientUi],
  );

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
    if (usingTreeMode) {
      if (!editableTree) return;
      const { tree: nextTree, nodeId } = addMoveToTree(editableTree, currentNodeId, {
        from,
        to,
        promotion,
      });
      setEditableTree(nextTree);
      setCurrentNodeId(nodeId);
      return;
    }

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

  // Tree used purely for the PGNViewer display — in tree mode this is
  // the real editable tree; in flat mode it's rebuilt from moveHistory
  // so PGNViewer never has to know which mode it's in.
  const displayTree = useMemo(() => {
    if (usingTreeMode) return editableTree ?? buildLinearMoveTree([], initialFen);
    return buildLinearMoveTree(moveHistory, initialFen);
  }, [usingTreeMode, editableTree, moveHistory, initialFen]);

  const displayCurrentNodeId = usingTreeMode
    ? currentNodeId
    : currentPly === 0
      ? ROOT_NODE_ID
      : `p${currentPly}`;

  const handleViewerSelectNode = usingTreeMode
    ? goToNode
    : (nodeId: string) => {
      const node = displayTree.nodes[nodeId];
      navigateToPly(node ? node.ply : 0);
    };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-stretch xl:gap-4">
      <div className="flex min-h-0 min-w-0 flex-col gap-2 xl:row-span-full">
        {topPlayerElement ? (
          <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] xl:max-w-[min(100%,calc(100vh-11rem))] flex items-center justify-between">
            {topPlayerElement}
          </div>
        ) : null}
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
        {bottomPlayerElement ? (
          <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] xl:max-w-[min(100%,calc(100vh-11rem))] flex items-center justify-between">
            {bottomPlayerElement}
          </div>
        ) : null}

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

      <div className={`flex min-w-0 flex-col items-center xl:items-stretch gap-3 xl:h-full xl:min-h-0 ${topPlayerElement ? "xl:pt-[3rem]" : "xl:pt-0"
        } ${bottomPlayerElement ? "xl:pb-8" : "xl:pb-0"
        }`}>
        {pgnViewer ? (
          <div className="flex min-h-0 w-full max-w-[20rem] flex-1 flex-col mx-auto xl:mx-0">
            <PGNViewer
              tree={displayTree}
              currentNodeId={displayCurrentNodeId}
              onSelectNode={handleViewerSelectNode}
            />
          </div>
        ) : null}

        {gameStatusElement ? (
          <div className="w-full max-w-[20rem] mx-auto xl:mx-0">
            {gameStatusElement}
          </div>
        ) : null}

        {controlBar ? (
          <div className="w-full max-w-[20rem] mx-auto xl:mx-0">
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
          <div className="w-full max-w-[20rem] mx-auto xl:mx-0">
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
      </div>
    </div>
  );
}
