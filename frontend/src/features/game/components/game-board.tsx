"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import BoardWithControls from "@/components/chessboard/BoardWithControls";
import { PlayerLabel, type LivePlayerDisplay } from "@/features/game/components/player-label";
import { Timer } from "@/features/game/components/timer";
import { getTokenUserId } from "@/features/auth/lib/jwt";
import { useAuth } from "@/providers/auth-provider";
import { parseFen } from "@/lib/chessboard/fen";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { INITIAL_FEN } from "@/lib/chessboard/fen";
import { SiteNav } from "@/components/site-nav";
import { joinMatchmaking, getMatchmakingStatus, leaveMatchmaking } from "@/lib/game-api";

function Spinner({ className = "h-4 w-4 text-amber-600" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

interface GameBoardProps {
  gameId: string;
}

export function GameBoard({ gameId }: GameBoardProps) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [playAgainError, setPlayAgainError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [queueState, setQueueState] = useState<"idle" | "joining" | "queued">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueStateRef = useRef(queueState);
  useEffect(() => {
    queueStateRef.current = queueState;
  }, [queueState]);
  const {
    snapshot,
    wsStatus,
    error,
    ratingUpdate,
    drawOfferState,
    actionPending,
    clockSyncedAt,
    sendMove,
    sendDrawOffer,
    acceptDrawOffer,
    declineDrawOffer,
    resign,
  } = useGameWebSocket(gameId);

  const myPlayerColor = useMemo(() => {
    if (!snapshot) return null;
    const userId = accessToken ? getTokenUserId(accessToken) : null;
    if (!userId) return null;
    if (snapshot.white.user_id === userId) return "white" as const;
    if (snapshot.black.user_id === userId) return "black" as const;
    return null;
  }, [accessToken, snapshot]);

  const currentTurnColor = useMemo(() => {
    if (!snapshot) return "white";
    return parseFen(snapshot.fen).turn === "w" ? "white" : "black";
  }, [snapshot]);

  const myTurn = useMemo(() => {
    if (!snapshot || !myPlayerColor) return false;
    return currentTurnColor === myPlayerColor;
  }, [snapshot, myPlayerColor, currentTurnColor]);

  const gameOver =
    snapshot?.status === "finished" || snapshot?.status === "abandoned";

  const myRatingChange = useMemo(() => {
    if (!ratingUpdate || !myPlayerColor) return null;
    return myPlayerColor === "white"
      ? ratingUpdate.white_rating_change
      : ratingUpdate.black_rating_change;
  }, [ratingUpdate, myPlayerColor]);

  const topPlayer = useMemo<LivePlayerDisplay | null>(() => {
    if (!snapshot) return null;
    const participant =
      myPlayerColor === "black" ? snapshot.white : snapshot.black;
    return {
      userId: participant.user_id,
      username: participant.username,
      rating: participant.rating,
    };
  }, [myPlayerColor, snapshot]);

  const bottomPlayer = useMemo<LivePlayerDisplay | null>(() => {
    if (!snapshot) return null;
    const participant =
      myPlayerColor === "black" ? snapshot.black : snapshot.white;
    return {
      userId: participant.user_id,
      username: participant.username,
      rating: participant.rating,
    };
  }, [myPlayerColor, snapshot]);

  const topColor = myPlayerColor === "black" ? "white" : "black";
  const bottomColor = myPlayerColor === "black" ? "black" : "white";

  const renderPlayerHeader = (
    player: LivePlayerDisplay | null,
    color: "white" | "black",
  ) => {
    if (!player) return null;
    const isTimed = Boolean(snapshot && snapshot.initial_time_ms > 0);
    const remainingMs =
      snapshot
        ? color === "white"
          ? snapshot.white_time_left_ms
          : snapshot.black_time_left_ms
        : undefined;
    const isRunning = Boolean(
      snapshot && snapshot.status === "active" && currentTurnColor === color,
    );

    return (
      <div className="flex w-full items-center justify-between">
        <PlayerLabel player={player} />
        {isTimed && remainingMs !== undefined ? (
          <Timer
            remainingMs={remainingMs}
            isRunning={isRunning}
            syncedAt={clockSyncedAt}
          />
        ) : null}
      </div>
    );
  };

  const canAct = Boolean(myPlayerColor) && !gameOver && wsStatus === "open";
  const hasIncomingDrawOffer = drawOfferState === "incoming";
  const hasOutgoingDrawOffer = drawOfferState === "outgoing";

  const statusElement = gameOver && snapshot ? (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-center shadow-sm text-sm flex flex-col gap-2">
      <div className="font-semibold text-ink flex items-center justify-center gap-1.5 flex-wrap">
        <span>
          {snapshot.result === "1-0" && "White wins"}
          {snapshot.result === "0-1" && "Black wins"}
          {snapshot.result === "1/2-1/2" && "Draw"}
          {!snapshot.result && "Game over"}
        </span>
        {snapshot.termination && (
          <span className="text-xs capitalize text-ink-faint">
            • {snapshot.termination.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {snapshot.rated && (
        <div className="text-xs font-medium text-ink-secondary">
          {myRatingChange
            ? `Rating ${myRatingChange.delta >= 0 ? "+" : ""}${myRatingChange.delta} (${myRatingChange.after})`
            : "Rating updating..."}
        </div>
      )}
    </div>
  ) : null;

  function stopPolling() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function startQueuePolling() {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getMatchmakingStatus();
        if (status.state === "matched" && status.active_game_id) {
          stopPolling();
          setQueueState("idle");
          router.push(`/game/${status.active_game_id}`);
        } else if (status.state === "idle") {
          stopPolling();
          setQueueState("idle");
        }
      } catch {
        // poll silently
      }
    }, 1500);
  }

  async function handlePlayAgain() {
    if (!snapshot) return;
    setPlayAgainError(null);
    setQueueState("joining");
    try {
      await joinMatchmaking(
        { initial_time_ms: snapshot.initial_time_ms, increment_ms: snapshot.increment_ms },
        snapshot.rated,
      );
      setQueueState("queued");
      startQueuePolling();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409") || msg.toLowerCase().includes("conflict")) {
        setQueueState("queued");
        startQueuePolling();
      } else {
        setQueueState("idle");
        setPlayAgainError(msg);
      }
    }
  }

  async function handleCancelQueue() {
    stopPolling();
    try {
      await leaveMatchmaking();
    } catch {
      // ignore
    }
    setQueueState("idle");
  }

  // Leave queue on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (queueStateRef.current === "joining" || queueStateRef.current === "queued") {
        leaveMatchmaking().catch(() => { });
      }
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-canvas px-4 py-6 text-ink-strong">
      <SiteNav />

      {wsStatus !== "open" && (
        <div className="mx-auto w-full max-w-4xl rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-950/30 dark:text-yellow-300">
          {wsStatus === "connecting" && "Connecting to game…"}
          {wsStatus === "closed" && "Disconnected. Refresh to reconnect."}
          {wsStatus === "error" && "Connection error. Refresh to reconnect."}
        </div>
      )}

      {error && (
        <div className="mx-auto w-full max-w-4xl rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="flex h-full w-full max-w-4xl">
          <BoardWithControls
            key={`${gameId}-${myPlayerColor ?? "seat"}`}
            fen={snapshot?.fen ?? INITIAL_FEN}
            orientation={myPlayerColor ?? "white"}
            moves={snapshot?.moves}
            onMove={sendMove}
            interactionEnabled={myTurn && !gameOver}
            controlBar
            pgnViewer
            forLiveGame={true}
            topPlayerElement={renderPlayerHeader(topPlayer, topColor)}
            bottomPlayerElement={renderPlayerHeader(bottomPlayer, bottomColor)}
            onDrawOffer={sendDrawOffer}
            onDrawAccept={acceptDrawOffer}
            onDrawDecline={declineDrawOffer}
            onResign={resign}
            canOfferDraw={canAct && !hasIncomingDrawOffer && !hasOutgoingDrawOffer}
            canResign={canAct}
            hasIncomingDrawOffer={hasIncomingDrawOffer}
            hasOutgoingDrawOffer={hasOutgoingDrawOffer}
            actionPending={actionPending !== null}
            gameStatusElement={statusElement}
          />

          {!dismissed && gameOver && snapshot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="relative flex w-96 flex-col items-center gap-5 rounded-xl border border-line-strong bg-surface px-10 py-8 shadow-2xl dark:bg-canvas">
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-muted hover:text-ink-secondary"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="text-center">
                  <div className="text-xl font-bold text-ink">
                    {snapshot.result === "1-0" && "White wins"}
                    {snapshot.result === "0-1" && "Black wins"}
                    {snapshot.result === "1/2-1/2" && "Draw"}
                    {!snapshot.result && "Game over"}
                  </div>
                  {snapshot.termination && (
                    <div className="mt-1 text-sm capitalize text-ink-muted">
                      {snapshot.termination.replace(/_/g, " ")}
                    </div>
                  )}
                  {snapshot.rated && myRatingChange && (
                    <div className="mt-1.5 text-sm font-medium text-ink-secondary">
                      Rating {myRatingChange.delta >= 0 ? "+" : ""}{myRatingChange.delta} ({myRatingChange.after})
                    </div>
                  )}
                </div>

                {queueState === "idle" && (
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      onClick={handlePlayAgain}
                      className="flex-1 rounded-lg bg-[#f59e0b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400"
                    >
                      Play Again
                    </button>

                    <Link
                      href={`/game-history/${gameId}?analysis=true`}
                      className="flex-1 rounded-lg border px-4 py-2.5 text-center text-sm font-semibold transition hover:text-white dark:hover:text-white"
                    >
                      Analyze
                    </Link>
                  </div>
                )}

                {queueState === "joining" && (
                  <div className="flex w-full items-center justify-center gap-2 py-2.5">
                    <Spinner />
                    <span className="text-sm text-ink-secondary">Joining queue…</span>
                  </div>
                )}

                {queueState === "queued" && (
                  <div className="flex w-full flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Spinner />
                      <span className="text-sm text-ink-secondary">Searching for opponent…</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelQueue}
                      className="text-xs text-ink-faint transition hover:text-ink-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {playAgainError && (
                  <div className="text-xs text-red-500 text-center">{playAgainError}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
