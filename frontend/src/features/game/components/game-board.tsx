"use client";

import { useMemo } from "react";

import BoardWithControls from "@/components/chessboard/BoardWithControls";
import { PlayerLabel, type LivePlayerDisplay } from "@/features/game/components/player-label";
import { getTokenUserId } from "@/features/auth/lib/jwt";
import { useAuth } from "@/providers/auth-provider";
import { parseFen } from "@/lib/chessboard/fen";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { INITIAL_FEN } from "@/lib/chessboard/fen";
import { SiteNav } from "@/components/site-nav";

interface GameBoardProps {
  gameId: string;
}

export function GameBoard({ gameId }: GameBoardProps) {
  const { accessToken } = useAuth();
  const {
    snapshot,
    wsStatus,
    error,
    ratingUpdate,
    drawOfferState,
    actionPending,
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

  const myTurn = useMemo(() => {
    if (!snapshot || !myPlayerColor) return false;
    const turn = parseFen(snapshot.fen).turn;
    return (
      (myPlayerColor === "white" && turn === "w") ||
      (myPlayerColor === "black" && turn === "b")
    );
  }, [snapshot, myPlayerColor]);

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
  const canAct = Boolean(myPlayerColor) && !gameOver && wsStatus === "open";
  const hasIncomingDrawOffer = drawOfferState === "incoming";
  const hasOutgoingDrawOffer = drawOfferState === "outgoing";

  const statusElement = gameOver && snapshot ? (
    <div className="rounded-sm border border-neutral-200 bg-white px-3 py-2 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 text-sm">
      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-center gap-1.5 flex-wrap">
        <span>
          {snapshot.result === "1-0" && "White wins"}
          {snapshot.result === "0-1" && "Black wins"}
          {snapshot.result === "1/2-1/2" && "Draw"}
          {!snapshot.result && "Game over"}
        </span>
        {snapshot.termination && (
          <span className="text-xs capitalize text-neutral-400 dark:text-neutral-500">
            • {snapshot.termination.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {snapshot.rated && (
        <div className="mt-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {myRatingChange
            ? `Rating ${myRatingChange.delta >= 0 ? "+" : ""}${myRatingChange.delta} (${myRatingChange.after})`
            : "Rating updating..."}
        </div>
      )}
    </div>
  ) : null;

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-neutral-50 px-4 py-6 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
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
            topPlayerElement={<PlayerLabel player={topPlayer} />}
            bottomPlayerElement={<PlayerLabel player={bottomPlayer} />}
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
        </div>
      </div>
    </main>
  );
}
