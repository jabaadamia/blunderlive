"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import BoardWithControls from "@/components/chessboard/BoardWithControls";
import { INITIAL_FEN, isValidFen } from "@/lib/chessboard/fen";
import { SiteNav } from "@/components/site-nav";
import { buildMoveTreeFromPgn, ROOT_NODE_ID, type MoveTree } from "@/lib/chessboard/history";
import { useStockfish } from "@/features/analysis/hooks/useStockfish";
import { EvaluationBar } from "@/features/analysis/components/EvaluationBar";
import { EnginePanel } from "@/features/analysis/components/EnginePanel";
import { FaCopy } from "react-icons/fa";

export function AnalysisBoard() {
  const [currentNodeId, setCurrentNodeId] = useState(ROOT_NODE_ID);
  const [currentFen, setCurrentFen] = useState(INITIAL_FEN);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [fenError, setFenError] = useState<string | null>(null);

  const [initialFen, setInitialFen] = useState(INITIAL_FEN);
  const [initialTreeKey, setInitialTreeKey] = useState(0);
  const [fenInput, setFenInput] = useState(INITIAL_FEN);

  const tree = useMemo(() => {
    return buildMoveTreeFromPgn("", initialFen, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTreeKey, initialFen]);

  // Keep the FEN field in sync with the board's current position.
  useEffect(() => {
    setFenInput(currentFen);
  }, [currentFen]);

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
    setInitialFen(INITIAL_FEN);
    setInitialTreeKey((prev) => prev + 1);
    setCurrentNodeId(ROOT_NODE_ID);
    setFenError(null);
  }, []);

  const handleApplyFen = useCallback(
    (fen: string) => {
      const trimmed = fen.trim();
      if (!isValidFen(trimmed)) {
        setFenError("Invalid FEN");
        return;
      }
      if (trimmed === initialFen && currentNodeId === ROOT_NODE_ID) {
        setFenError(null);
        return;
      }
      setFenError(null);
      setCopiedNotification(null);
      setInitialFen(trimmed);
      setInitialTreeKey((prev) => prev + 1);
      setCurrentNodeId(ROOT_NODE_ID);
      setFenInput(trimmed);
    },
    [initialFen, currentNodeId],
  );

  const handleCopyFen = useCallback(() => {
    void navigator.clipboard.writeText(currentFen);
    setCopiedNotification("FEN copied!");
    setTimeout(() => setCopiedNotification(null), 2000);
  }, [currentFen]);

  const statusElement = (
    <div className="rounded-sm border border-neutral-200 bg-white px-3 py-2 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 text-sm flex flex-col gap-2">
      <div className="relative">
        <input
          type="text"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleApplyFen(fenInput);
          }}
          onBlur={() => handleApplyFen(fenInput)}
          spellCheck={false}
          placeholder="Paste FEN to load it…"
          title="FEN of the current position, paste a new FEN and click outside to load it"
          className="w-full rounded border border-neutral-200 bg-neutral-50 px-2 py-1 pr-8 font-mono text-[0.6875rem] text-neutral-800 outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:bg-neutral-900"
        />
        <button
          type="button"
          onClick={handleCopyFen}
          title="Copy FEN"
          aria-label="Copy FEN"
          className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <FaCopy className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-neutral-100 pt-1 dark:border-neutral-800">
        <button
          type="button"
          onClick={handleResetPosition}
          className="rounded bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          Reset
        </button>

        {fenError ? (
          <span className="text-xs font-medium text-red-500 dark:text-red-400">{fenError}</span>
        ) : copiedNotification ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {copiedNotification}
          </span>
        ) : null}
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
