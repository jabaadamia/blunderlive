"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import BoardWithControls from "@/components/chessboard/BoardWithControls";
import { INITIAL_FEN } from "@/lib/chessboard/fen";
import { SiteNav } from "@/components/site-nav";
import { buildMoveTreeFromPgn, ROOT_NODE_ID, type MoveTree } from "@/lib/chessboard/history";
import { useStockfish } from "@/features/analysis/hooks/useStockfish";
import { EvaluationBar } from "@/features/analysis/components/EvaluationBar";
import { EnginePanel } from "@/features/analysis/components/EnginePanel";

export function AnalysisBoard() {
  const [currentNodeId, setCurrentNodeId] = useState(ROOT_NODE_ID);
  const [currentFen, setCurrentFen] = useState(INITIAL_FEN);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const [initialTreeKey, setInitialTreeKey] = useState(0);

  const tree = useMemo(() => {
    return buildMoveTreeFromPgn("", INITIAL_FEN, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTreeKey]);

  const {
    isEngineReady,
    isEvaluating,
    evalResult,
    isEnabled,
    setIsEnabled,
    toggleAnalysis,
    evaluateFen,
  } = useStockfish();

  // Enable engine by default on the analysis page
  useEffect(() => {
    setIsEnabled(true);
  }, [setIsEnabled]);

  useEffect(() => {
    if (isEnabled && currentFen) {
      evaluateFen(currentFen);
    }
  }, [isEnabled, currentFen, evaluateFen]);

  const handleResetPosition = useCallback(() => {
    setInitialTreeKey((prev) => prev + 1);
    setCurrentNodeId(ROOT_NODE_ID);
  }, []);

  const handleCopyFen = useCallback(() => {
    void navigator.clipboard.writeText(currentFen);
    setCopiedNotification("FEN copied!");
    setTimeout(() => setCopiedNotification(null), 2000);
  }, [currentFen]);

  const statusElement = (
    <div className="rounded-sm border border-neutral-200 bg-white px-3 py-2 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 text-sm flex flex-col gap-2">
      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
        Analysis Board
      </div>

      <div className="flex items-center justify-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800 flex-wrap">
        <button
          type="button"
          onClick={handleResetPosition}
          className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={handleCopyFen}
          className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition"
        >
          {copiedNotification ?? "Copy FEN"}
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-neutral-50 px-4 py-6 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteNav />

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="flex h-full w-full max-w-4xl">
          <BoardWithControls
            key={`analysis-board-${initialTreeKey}`}
            moveTree={tree}
            onNodeChange={setCurrentNodeId}
            onFenChange={setCurrentFen}
            interactionEnabled={true}
            controlBar
            pgnViewer
            forLiveGame={false}
            gameStatusElement={statusElement}
            evaluationBar={(orientation) => (
              <EvaluationBar
                evalResult={isEnabled ? evalResult : null}
                isEvaluating={isEvaluating}
                fen={currentFen}
                orientation={orientation}
              />
            )}
            analysisPanel={
              <EnginePanel
                evalResult={evalResult}
                isEvaluating={isEvaluating}
                isEngineReady={isEngineReady}
                isEnabled={isEnabled}
                fen={currentFen}
                onToggle={toggleAnalysis}
              />
            }
            bestMoveUci={isEnabled ? evalResult?.bestMove : undefined}
          />
        </div>
      </div>
    </main>
  );
}
