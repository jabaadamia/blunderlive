'use client';

import { useEffect, useMemo, useRef } from 'react';

interface PGNViewerProps {
  moves: string[]; // SAN moves
  currentPly: number; // 0 = initial position, 1 = after white's first move ...
  onSelectPly: (ply: number) => void;
}

export default function PGNViewer({
  moves,
  currentPly,
  onSelectPly,
}: PGNViewerProps) {
  const activeMoveRef = useRef<HTMLButtonElement | null>(null);

  const pairs = useMemo(() => {
    const result: {
      moveNumber: number;
      white: { san: string; ply: number };
      black?: { san: string; ply: number };
    }[] = [];

    for (let i = 0; i < moves.length; i += 2) {
      result.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: {
          san: moves[i],
          ply: i + 1,
        },
        black: moves[i + 1]
          ? {
              san: moves[i + 1],
              ply: i + 2,
            }
          : undefined,
      });
    }

    return result;
  }, [moves]);

  useEffect(() => {
    activeMoveRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [currentPly]);

  return (
    <div className="w-72 shrink-0 rounded-lg border border-border bg-background overflow-hidden">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-700 dark:text-neutral-200">
          Moves
        </h2>
      </div>

      <div className="max-h-full overflow-y-auto px-2 py-2">
        {pairs.length === 0 ? (
          <p className="px-2 py-1 text-sm text-neutral-500 dark:text-neutral-400">
            No moves yet.
          </p>
        ) : (
          <div className="space-y-0.5">
            {pairs.map(({ moveNumber, white, black }) => (
              <div
                key={moveNumber}
                className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 rounded-md px-1 py-0.5"
              >
                <span className="text-xs text-neutral-400 tabular-nums">
                  {moveNumber}.
                </span>

                <MoveButton
                  san={white.san}
                  ply={white.ply}
                  isActive={currentPly === white.ply}
                  onClick={onSelectPly}
                  ref={currentPly === white.ply ? activeMoveRef : undefined}
                />

                {black ? (
                  <MoveButton
                    san={black.san}
                    ply={black.ply}
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
        )}
      </div>
    </div>
  );
}

import { forwardRef } from 'react';

interface MoveButtonProps {
  san: string;
  ply: number;
  isActive: boolean;
  onClick: (ply: number) => void;
}

const MoveButton = forwardRef<HTMLButtonElement, MoveButtonProps>(
  ({ san, ply, isActive, onClick }, ref) => {
    return (
      <button
        ref={ref}
        onClick={() => onClick(ply)}
        className={[
          'rounded px-2 py-1 text-left font-mono text-sm transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800',
          isActive
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black'
            : 'text-neutral-700 dark:text-neutral-300',
        ].join(' ')}
      >
        {san}
      </button>
    );
  }
);

MoveButton.displayName = 'MoveButton';