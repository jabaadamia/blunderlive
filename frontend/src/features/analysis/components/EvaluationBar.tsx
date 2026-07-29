"use client";

import { useMemo } from "react";
import type { StockfishEvalResult } from "../hooks/useStockfish";

interface EvaluationBarProps {
  evalResult: StockfishEvalResult | null;
  isEvaluating: boolean;
  fen: string;
  orientation?: "white" | "black";
}

export function EvaluationBar({
  evalResult,
  isEvaluating,
  fen,
  orientation = "white",
}: EvaluationBarProps) {
  const isCurrentFenEval = Boolean(evalResult && evalResult.fen === fen);

  const { whitePercentage, label } = useMemo(() => {
    if (!isCurrentFenEval || !evalResult) {
      return { whitePercentage: 50, label: "0.0" };
    }

    if (evalResult.mate !== undefined) {
      const mate = evalResult.mate;
      const isWhiteWinning = mate > 0;
      const labelText = `M${Math.abs(mate)}`;
      return {
        whitePercentage: isWhiteWinning ? 100 : 0,
        label: isWhiteWinning ? `+${labelText}` : `-${labelText}`,
      };
    }

    const cp = evalResult.cp ?? 0;
    // Sigmoid formula mapping centipawns to 0..100 percentage
    const winChance = 50 + 50 * (2 / (1 + Math.exp(-0.003 * cp)) - 1);
    const clampedPercentage = Math.max(4, Math.min(96, winChance));

    const evalInPawns = (cp / 100).toFixed(1);
    const formattedLabel = cp > 0 ? `+${evalInPawns}` : `${evalInPawns}`;

    return {
      whitePercentage: clampedPercentage,
      label: formattedLabel,
    };
  }, [evalResult, isCurrentFenEval]);

  const verticalFill = orientation === "white"
    ? whitePercentage
    : 100 - whitePercentage;

  const bottomBg = orientation === "white" ? "bg-white" : "bg-neutral-900";
  const topBg = orientation === "white" ? "bg-neutral-900" : "bg-white";

  return (
    <div className="relative flex h-full w-7 min-w-7 flex-col overflow-hidden rounded-md border border-neutral-300 shadow-inner dark:border-neutral-700">
      <div
        className={`w-full transition-all duration-300 ease-out ${topBg}`}
        style={{ height: `${100 - verticalFill}%` }}
      />
      <div
        className={`w-full transition-all duration-300 ease-out ${bottomBg}`}
        style={{ height: `${verticalFill}%` }}
      />
      <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
        <span className="rounded bg-neutral-950/80 px-1 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white shadow-sm backdrop-blur-xs">
          {isEvaluating && !isCurrentFenEval ? "..." : label}
        </span>
      </div>
    </div>
  );
}
