"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import BoardWithControls from "@/components/chessboard/BoardWithControls";
import { getTokenUserId } from "@/features/auth/lib/jwt";
import { useAuth } from "@/providers/auth-provider";
import { INITIAL_FEN } from "@/lib/chessboard/fen";
import { SiteNav } from "@/components/site-nav";
import { Timer } from "@/features/game/components/timer";
import {
  getGameDetail,
  type GameDetail,
  type PlayerDetail,
} from "@/features/game/lib/game-api";
import { buildMoveTreeFromPgn, ROOT_NODE_ID } from "@/lib/chessboard/history";

interface HistoryBoardProps {
  gameId: string;
}

export function HistoryBoard({ gameId }: HistoryBoardProps) {
  const { accessToken } = useAuth();
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState(ROOT_NODE_ID);
  const [prevGameId, setPrevGameId] = useState(gameId);

  useEffect(() => {
    let isMounted = true;
    getGameDetail(gameId)
      .then((detail) => {
        if (!isMounted) return;
        if (detail) {
          setGameDetail(detail);
        } else {
          setError("Failed to load game.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch game history details:", err);
        if (isMounted) setError("Failed to load game.");
      });
    return () => {
      isMounted = false;
    };
  }, [gameId]);

  const myPlayerColor = useMemo(() => {
    if (!gameDetail) return null;
    const userId = accessToken ? getTokenUserId(accessToken) : null;
    if (!userId) return null;
    if (gameDetail.white_player?.id === userId) return "white" as const;
    if (gameDetail.black_player?.id === userId) return "black" as const;
    return null;
  }, [accessToken, gameDetail]);

  const isFlipped = myPlayerColor === "black";
  const pgn = gameDetail?.pgn;

  const tree = useMemo(() => {
    if (!pgn || !gameDetail) return null;
    return buildMoveTreeFromPgn(pgn, INITIAL_FEN, gameDetail.initial_time_ms);
  }, [pgn, gameDetail]);

  if (gameId !== prevGameId) {
    setPrevGameId(gameId);
    setCurrentNodeId(ROOT_NODE_ID);
  }
  const topColor = isFlipped ? "white" : "black";
  const bottomColor = isFlipped ? "black" : "white";

  const topPlayer = isFlipped ? gameDetail?.white_player : gameDetail?.black_player;
  const bottomPlayer = isFlipped ? gameDetail?.black_player : gameDetail?.white_player;
  const topDelta = isFlipped ? gameDetail?.white_rating_delta : gameDetail?.black_rating_delta;
  const bottomDelta = isFlipped ? gameDetail?.black_rating_delta : gameDetail?.white_rating_delta;

  const currentNode = tree?.nodes[currentNodeId];
  const currentWhiteTimeMs = currentNode?.whiteTimeLeftMs ?? gameDetail?.initial_time_ms ?? 0;
  const currentBlackTimeMs = currentNode?.blackTimeLeftMs ?? gameDetail?.initial_time_ms ?? 0;

  const topTimeMs = topColor === "white" ? currentWhiteTimeMs : currentBlackTimeMs;
  const bottomTimeMs = bottomColor === "white" ? currentWhiteTimeMs : currentBlackTimeMs;

  const renderPlayer = (
    player: PlayerDetail | null | undefined,
    delta: number | null | undefined,
    remainingMs?: number,
  ) => {
    if (!player) return <div className="h-6" />;
    const isTimed = Boolean(gameDetail && gameDetail.initial_time_ms > 0);
    return (
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Link
            href={`/profile/${player.id}`}
            className="text-neutral-900 hover:underline dark:text-neutral-100"
          >
            {player.username}
          </Link>
          {delta !== undefined && delta !== null && (
            <span
              className={`text-sm ${delta > 0
                ? "text-green-600 dark:text-green-400"
                : delta < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-neutral-500"
                }`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>
        {isTimed && remainingMs !== undefined ? (
          <Timer remainingMs={remainingMs} isRunning={false} syncedAt={0} />
        ) : null}
      </div>
    );
  };

  const statusElement = gameDetail ? (
    <div className="rounded-sm border border-neutral-200 bg-white px-3 py-2 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 text-sm">
      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-center gap-1.5 flex-wrap">
        <span>
          {gameDetail.result === "1-0" && "White wins"}
          {gameDetail.result === "0-1" && "Black wins"}
          {gameDetail.result === "1/2-1/2" && "Draw"}
          {!gameDetail.result && "Game over"}
        </span>
        {gameDetail.termination && (
          <span className="text-xs capitalize text-neutral-400 dark:text-neutral-500">
            • {gameDetail.termination.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {gameDetail.rated &&
        (gameDetail.white_rating_delta !== null || gameDetail.black_rating_delta !== null) && (
          <div className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-center gap-3 flex-wrap">
            {gameDetail.white_rating_delta !== null && (
              <span>
                White: {gameDetail.white_rating_delta >= 0 ? "+" : ""}
                {gameDetail.white_rating_delta}
              </span>
            )}
            {gameDetail.black_rating_delta !== null && (
              <span>
                Black: {gameDetail.black_rating_delta >= 0 ? "+" : ""}
                {gameDetail.black_rating_delta}
              </span>
            )}
          </div>
        )}
    </div>
  ) : null;

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-neutral-50 px-4 py-6 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteNav />

      {error && (
        <div className="mx-auto w-full max-w-4xl rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="flex h-full w-full max-w-4xl">
          <BoardWithControls
            key={gameId}
            orientation={myPlayerColor ?? "white"}
            moveTree={tree ?? undefined}
            onNodeChange={setCurrentNodeId}
            interactionEnabled={true}
            controlBar
            pgnViewer
            forLiveGame={false}
            topPlayerElement={renderPlayer(topPlayer, topDelta, topTimeMs)}
            bottomPlayerElement={renderPlayer(bottomPlayer, bottomDelta, bottomTimeMs)}
            gameStatusElement={statusElement}
          />
        </div>
      </div>
    </main>
  );
}

