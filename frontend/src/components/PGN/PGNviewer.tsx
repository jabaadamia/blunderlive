"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";

import type { MoveHistoryEntry } from "@/lib/chessboard/history";

interface PGNViewerProps {
  entries: MoveHistoryEntry[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export default function PGNViewer({
  entries,
  currentPly,
  onSelectPly,
}: PGNViewerProps) {
  const activeMoveRef = useRef<HTMLButtonElement | null>(null);

  const movePairs = useMemo(() => {
    const pairs: {
      moveNumber: number;
      white: MoveHistoryEntry;
      black?: MoveHistoryEntry;
    }[] = [];

    for (let index = 0; index < entries.length; index += 2) {
      pairs.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: entries[index],
        black: entries[index + 1],
      });
    }

    return pairs;
  }, [entries]);

  useEffect(() => {
    activeMoveRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentPly]);

  return (
    <aside className="flex min-h-[15rem] w-full min-w-0 max-w-[20rem] flex-col overflow-hidden rounded-sm border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 xl:h-full xl:min-h-0 xl:max-w-[20rem]">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {movePairs.length > 0 ? (
          <div className="space-y-1">
            {movePairs.map(({ moveNumber, white, black }) => (
              <div
                key={moveNumber}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 px-1 py-0.5"
              >
                <span className="text-sm font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  {moveNumber}.
                </span>

                <MoveButton
                  entry={white}
                  isActive={currentPly === white.ply}
                  onClick={onSelectPly}
                  ref={currentPly === white.ply ? activeMoveRef : undefined}
                />

                {black ? (
                  <MoveButton
                    entry={black}
                    isActive={currentPly === black.ply}
                    onClick={onSelectPly}
                    ref={currentPly === black.ply ? activeMoveRef : undefined}
                  />
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

interface MoveButtonProps {
  entry: MoveHistoryEntry;
  isActive: boolean;
  onClick: (ply: number) => void;
}

const MoveButton = forwardRef<HTMLButtonElement, MoveButtonProps>(
  ({ entry, isActive, onClick }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onClick(entry.ply)}
        className={[
          "min-w-0 rounded-sm px-2 py-1.5 text-left font-mono text-sm transition",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800",
          isActive
            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-700 dark:text-neutral-300",
        ].join(" ")}
        title={`${entry.ply}. ${entry.san}`}
      >
        <span className="block truncate">{entry.san}</span>
      </button>
    );
  },
);

MoveButton.displayName = "MoveButton";
