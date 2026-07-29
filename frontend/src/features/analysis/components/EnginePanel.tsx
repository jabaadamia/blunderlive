"use client";

import { useMemo } from "react";
import type { StockfishEvalResult } from "../hooks/useStockfish";
import { formatSanPvString } from "@/lib/chessboard/uciToSan";

interface EnginePanelProps {
  evalResult: StockfishEvalResult | null;
  isEvaluating: boolean;
  isEngineReady: boolean;
  isEnabled: boolean;
  fen: string;
  onToggle?: () => void;
  onPlayBestMove?: () => void;
}

export function EnginePanel({
  evalResult,
  isEvaluating,
  isEngineReady,
  isEnabled,
  fen,
  onToggle,
  onPlayBestMove,
}: EnginePanelProps) {
  const isCurrentFenEval = Boolean(evalResult && evalResult.fen === fen);

  const formattedLine = useMemo(() => {
    if (!isCurrentFenEval || !evalResult || !evalResult.pv || evalResult.pv.length === 0) {
      return "";
    }
    return formatSanPvString(fen, evalResult.pv, 7);
  }, [evalResult, fen, isCurrentFenEval]);

  const scoreText = useMemo(() => {
    if (!isCurrentFenEval || !evalResult) return "...";
    if (evalResult.mate !== undefined) {
      const m = evalResult.mate;
      return m > 0 ? `+#M${m}` : `-#M${Math.abs(m)}`;
    }
    const cp = (evalResult.cp ?? 0) / 100;
    return cp > 0 ? `+${cp.toFixed(2)}` : cp.toFixed(2);
  }, [evalResult, isCurrentFenEval]);

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-2.5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
          <span className={`flex h-2 w-2 rounded-full ${isEvaluating ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
          <span>Stockfish 18</span>
          {isEnabled && isCurrentFenEval && evalResult && (
            <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
              (Depth {evalResult.depth})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEnabled && (
            <span className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-50">
              {scoreText}
            </span>
          )}
          <label className="flex items-center cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={onToggle}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isEnabled
                  ? "bg-emerald-500"
                  : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {isEnabled && (
        <div className="min-h-[2.5rem]">
          {formattedLine ? (
            <div className="font-mono text-neutral-700 dark:text-neutral-300 break-words leading-relaxed">
              {formattedLine}
            </div>
          ) : (
            <div className="text-neutral-400 italic py-1">
              {!isEngineReady ? "Loading engine..." : isEvaluating ? "Calculating best line..." : "Engine ready"}
            </div>
          )}
        </div>
      )}

      {isEnabled && isCurrentFenEval && evalResult?.bestMove && onPlayBestMove && (
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>
            Press <kbd className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-[10px] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">Space</kbd> to play best move
          </span>
          <button
            type="button"
            onClick={onPlayBestMove}
            className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
          >
            Play Move
          </button>
        </div>
      )}
    </div>
  );
}
