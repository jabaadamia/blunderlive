"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import {
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
} from "@/lib/game-api";

type LobbyState = "idle" | "joining" | "queued" | "matched" | "error";

const POLL_INTERVAL_MS = 1500;

export function MatchmakingLobby() {
  const router = useRouter();
  const [lobbyState, setLobbyState] = useState<LobbyState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await getMatchmakingStatus();
        if (status.state === "matched" && status.active_game_id) {
          stopPolling();
          setLobbyState("matched");
          router.push(`/game/${status.active_game_id}`);
        }
      } catch {
        // silently ignore transient poll errors
      }
    }, POLL_INTERVAL_MS);
  }, [router, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  async function handlePlay() {
    setLobbyState("joining");
    setErrorMessage(null);

    try {
      await joinMatchmaking({ initial_time_ms: 300_000, increment_ms: 0 }, true);
      setLobbyState("queued");
      startPolling();
    } catch (err) {
      // 409 means already queued or in a game — start polling to pick up state
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("409") || message.toLowerCase().includes("conflict")) {
        setLobbyState("queued");
        startPolling();
      } else {
        setLobbyState("error");
        setErrorMessage(message);
      }
    }
  }

  async function handleCancel() {
    stopPolling();
    try {
      await leaveMatchmaking();
    } catch {
      // ignore
    }
    setLobbyState("idle");
    setErrorMessage(null);
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <SiteNav />

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm uppercase tracking-widest text-neutral-500">
              BlunderLive
            </p>
            <h1 className="text-4xl font-bold">Find a game</h1>
            <p className="mt-1 text-sm text-neutral-500">5 + 0 · Rated</p>
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            {lobbyState === "idle" && (
              <button
                type="button"
                onClick={handlePlay}
                className="w-full rounded-lg bg-neutral-900 px-6 py-4 text-lg font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Play
              </button>
            )}

            {lobbyState === "joining" && (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-6 py-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <Spinner />
                Joining queue…
              </div>
            )}

            {lobbyState === "queued" && (
              <>
                <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-6 py-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  <Spinner />
                  Looking for an opponent…
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-sm text-neutral-500 underline-offset-4 hover:underline"
                >
                  Cancel
                </button>
              </>
            )}

            {lobbyState === "matched" && (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-6 py-4 text-sm font-medium text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
                <Spinner />
                Match found! Loading game…
              </div>
            )}

            {lobbyState === "error" && (
              <>
                <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {errorMessage ?? "Something went wrong."}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLobbyState("idle");
                    setErrorMessage(null);
                  }}
                  className="text-sm text-neutral-500 underline-offset-4 hover:underline"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
