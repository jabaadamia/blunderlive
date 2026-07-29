"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { parseFen } from "@/lib/chessboard/fen";
import { getLegalMoves, isCheck } from "@/lib/chessboard/moveGen";

export interface StockfishEvalResult {
  fen: string;
  cp?: number;
  mate?: number;
  depth: number;
  bestMove?: string;
  pv: string[];
}

const STOCKFISH_PATH = "/stockfish/stockfish-18-lite-single.js";

function createStockfishWorker(): Worker | null {
  try {
    const worker = new Worker(STOCKFISH_PATH);
    worker.onerror = (err) => {
      console.error("Stockfish Worker error:", err);
    };
    return worker;
  } catch (err) {
    console.error("Failed to create Stockfish Worker:", err);
    return null;
  }
}

export function useStockfish() {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<StockfishEvalResult | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const currentFenRef = useRef<string | null>(null);
  const pendingEvalRef = useRef<{ fen: string; depth: number } | null>(null);
  const goCountRef = useRef(0);
  const bestmoveCountRef = useRef(0);

  const sendPositionAndGo = useCallback((worker: Worker, fen: string, depth: number) => {
    currentFenRef.current = fen;
    setEvalResult(null);
    setIsEvaluating(true);
    worker.postMessage("position fen " + fen);
    goCountRef.current++;
    worker.postMessage("go depth " + depth);
  }, []);

  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = createStockfishWorker();
    if (!worker) return null;

    worker.onmessage = (event: MessageEvent) => {
      const line = typeof event.data === "string" ? event.data : String(event.data || "");

      if (line === "uciok" || line === "readyok") {
        setIsEngineReady(true);
      }

      if (line.startsWith("info ") && line.includes(" score ")) {
        const depthMatch = line.match(/depth\s+(\d+)/);
        const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
        const pvMatch = line.match(/\spv\s+(.+)$/);

        if (depthMatch && (cpMatch || mateMatch)) {
          const depth = parseInt(depthMatch[1], 10);
          const pvStr = pvMatch ? pvMatch[1].trim() : "";
          const pv = pvStr ? pvStr.split(/\s+/).filter(Boolean) : [];
          const bestMove = pv[0] || undefined;

          const fen = currentFenRef.current;
          if (!fen) return;

          const turn = parseFen(fen).turn;
          const sideMultiplier = turn === "w" ? 1 : -1;

          let cp: number | undefined;
          let mate: number | undefined;

          if (cpMatch) {
            cp = parseInt(cpMatch[1], 10) * sideMultiplier;
          }

          if (mateMatch) {
            mate = parseInt(mateMatch[1], 10) * sideMultiplier;
          }

          setEvalResult({
            fen,
            cp,
            mate,
            depth,
            bestMove,
            pv,
          });
        }
      }

      if (line.startsWith("bestmove ")) {
        bestmoveCountRef.current++;
        const parts = line.split(/\s+/);

        const pending = pendingEvalRef.current;
        if (pending) {
          pendingEvalRef.current = null;
          sendPositionAndGo(worker, pending.fen, pending.depth);
        } else {
          setIsEvaluating(false);
          const bestMove = parts[1];
          if (bestMove && bestMove !== "(none)") {
            setEvalResult((prev) => (prev ? { ...prev, bestMove } : prev));
          }
        }
      }
    };

    worker.postMessage("uci");
    worker.postMessage("isready");
    worker.postMessage("setoption name MultiPV value 1");

    workerRef.current = worker;
    return worker;
  }, [sendPositionAndGo]);

  const evaluateFen = useCallback(
    (fen: string, depth = 18) => {
      if (!isEnabled) return;

      // Terminal position (checkmate/stalemate), handle without Stockfish
      // to avoid the engine getting stuck waiting for a bestmove that may
      // never arrive (stockfish.js behaviour around terminal nodes can be
      // unreliable, causing goCountRef/bestmoveCountRef to de-sync).
      const gs = parseFen(fen);
      if (getLegalMoves(gs).length === 0) {
        if (workerRef.current && goCountRef.current > bestmoveCountRef.current) {
          workerRef.current.postMessage("stop");
        }
        pendingEvalRef.current = null;
        currentFenRef.current = fen;
        setIsEvaluating(false);
        setEvalResult({
          fen,
          cp: isCheck(gs) ? undefined : 0,
          mate: isCheck(gs) ? (gs.turn === "b" ? 1 : -1) : undefined,
          depth: 0,
          bestMove: undefined,
          pv: [],
        });
        return;
      }

      const worker = workerRef.current || initWorker();
      if (!worker) return;

      const isSearching = goCountRef.current > bestmoveCountRef.current;

      if (isSearching) {
        pendingEvalRef.current = { fen, depth };
        setEvalResult(null);
        setIsEvaluating(true);
        worker.postMessage("stop");
      } else {
        sendPositionAndGo(worker, fen, depth);
      }
    },
    [isEnabled, initWorker, sendPositionAndGo],
  );

  const stopEvaluation = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage("stop");
    }
    pendingEvalRef.current = null;
    setIsEvaluating(false);
  }, []);

  const toggleAnalysis = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      if (!next) {
        pendingEvalRef.current = null;
        if (workerRef.current) {
          workerRef.current.postMessage("stop");
        }
        setIsEvaluating(false);
        setEvalResult(null);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage("stop");
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    isEngineReady,
    isEvaluating,
    evalResult,
    isEnabled,
    setIsEnabled,
    toggleAnalysis,
    evaluateFen,
    stopEvaluation,
  };
}
