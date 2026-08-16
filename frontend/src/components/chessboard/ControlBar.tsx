'use client';

import type { IconType } from 'react-icons';
import {
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaUndoAlt,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';

interface ControlBarProps {
  canGoToFirst?: boolean;
  canGoToPrevious?: boolean;
  canGoToNext?: boolean;
  canGoToLast?: boolean;
  onFirstMove?: () => void;
  onPreviousMove?: () => void;
  onNextMove?: () => void;
  onLastMove?: () => void;
  onFlipBoard?: () => void;
}

function ControlButton({
  icon: Icon,
  title,
  disabled = false,
  onClick,
}: {
  icon: IconType;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-9 w-9 items-center justify-center text-ink-secondary transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default function ControlBar({
  canGoToFirst = false,
  canGoToPrevious = false,
  canGoToNext = false,
  canGoToLast = false,
  onFirstMove,
  onPreviousMove,
  onNextMove,
  onLastMove,
  onFlipBoard,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-center gap-1 py-1">
      <ControlButton
        icon={FaAngleDoubleLeft}
        title="First move"
        disabled={!canGoToFirst}
        onClick={onFirstMove}
      />
      <ControlButton
        icon={FaChevronLeft}
        title="Previous move"
        disabled={!canGoToPrevious}
        onClick={onPreviousMove}
      />
      <ControlButton
        icon={FaChevronRight}
        title="Next move"
        disabled={!canGoToNext}
        onClick={onNextMove}
      />
      <ControlButton
        icon={FaAngleDoubleRight}
        title="Last move"
        disabled={!canGoToLast}
        onClick={onLastMove}
      />
      <div className="mx-1 h-5 w-px bg-line dark:bg-line-strong" />
      <ControlButton
        icon={FaUndoAlt}
        title="Flip board"
        onClick={onFlipBoard}
      />
    </div>
  );
}
