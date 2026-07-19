"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiWind,
  FiZap,
  FiClock,
  FiSliders,
  FiPlay,
  FiX,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";

import { SiteNav } from "@/components/site-nav";
import {
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
  type TimeControl,
} from "@/lib/game-api";

type LobbyState = "idle" | "joining" | "queued" | "matched" | "error";

const POLL_INTERVAL_MS = 1500;

type Category = "Bullet" | "Blitz" | "Rapid";

const CATEGORY_ICON: Record<Category, typeof FiZap> = {
  Bullet: FiWind,
  Blitz: FiZap,
  Rapid: FiClock,
};

const TIME_PRESETS: {
  id: string;
  label: string;
  category: Category;
  initialTimeMs: number;
  incrementMs: number;
}[] = [
    { id: "bullet-1", label: "1 min", category: "Bullet", initialTimeMs: 60_000, incrementMs: 0 },
    { id: "bullet-2-1", label: "2 + 1", category: "Bullet", initialTimeMs: 120_000, incrementMs: 1_000 },
    { id: "blitz-3", label: "3 min", category: "Blitz", initialTimeMs: 180_000, incrementMs: 0 },
    { id: "blitz-3-2", label: "3 + 2", category: "Blitz", initialTimeMs: 180_000, incrementMs: 2_000 },
    { id: "blitz-5", label: "5 min", category: "Blitz", initialTimeMs: 300_000, incrementMs: 0 },
    { id: "rapid-10", label: "10 min", category: "Rapid", initialTimeMs: 600_000, incrementMs: 0 },
  ];

const CUSTOM_ID = "custom";
const DEFAULT_PRESET_ID = "blitz-5";
const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 180;
const MAX_CUSTOM_INCREMENT_SECONDS = 60;

export function MatchmakingLobby() {
  const router = useRouter();
  const [lobbyState, setLobbyState] = useState<LobbyState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PRESET_ID);
  const [customMinutes, setCustomMinutes] = useState("5");
  const [customIncrementSeconds, setCustomIncrementSeconds] = useState("0");
  const [rated, setRated] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedTimeControl: TimeControl = useMemo(() => {
    if (selectedId === CUSTOM_ID) {
      const minutes = clamp(Number(customMinutes) || 0, MIN_CUSTOM_MINUTES, MAX_CUSTOM_MINUTES);
      const incrementSeconds = clamp(Number(customIncrementSeconds) || 0, 0, MAX_CUSTOM_INCREMENT_SECONDS);
      return { initial_time_ms: minutes * 60_000, increment_ms: incrementSeconds * 1_000 };
    }

    const preset = TIME_PRESETS.find((p) => p.id === selectedId) ?? TIME_PRESETS[0];
    return { initial_time_ms: preset.initialTimeMs, increment_ms: preset.incrementMs };
  }, [selectedId, customMinutes, customIncrementSeconds]);

  const selectedLabel = useMemo(() => {
    if (selectedId === CUSTOM_ID) {
      const minutes = selectedTimeControl.initial_time_ms / 60_000;
      const incrementSeconds = selectedTimeControl.increment_ms / 1_000;
      return incrementSeconds > 0 ? `${minutes} + ${incrementSeconds}` : `${minutes} min`;
    }
    return TIME_PRESETS.find((p) => p.id === selectedId)?.label ?? "";
  }, [selectedId, selectedTimeControl]);

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

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  async function handlePlay() {
    setLobbyState("joining");
    setErrorMessage(null);

    try {
      await joinMatchmaking(selectedTimeControl, rated);
      setLobbyState("queued");
      startPolling();
    } catch (err) {
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
            <p className="mt-1 text-sm text-neutral-500">
              {selectedLabel} · {rated ? "Rated" : "Casual"}
            </p>
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            {lobbyState === "idle" && (
              <>
                <TimeControlPicker
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  customMinutes={customMinutes}
                  customIncrementSeconds={customIncrementSeconds}
                  onCustomMinutesChange={setCustomMinutes}
                  onCustomIncrementChange={setCustomIncrementSeconds}
                />

                <RatedToggle rated={rated} onChange={setRated} />

                <button
                  type="button"
                  onClick={handlePlay}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-6 py-4 text-lg font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  <FiPlay className="h-5 w-5" />
                  Play
                </button>
              </>
            )}

            {lobbyState === "joining" && (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-6 py-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <FiLoader className="h-4 w-4 animate-spin" />
                Joining queue…
              </div>
            )}

            {lobbyState === "queued" && (
              <>
                <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-6 py-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Looking for an opponent…
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1 text-sm text-neutral-500 underline-offset-4 hover:underline"
                >
                  <FiX className="h-4 w-4" />
                  Cancel
                </button>
              </>
            )}

            {lobbyState === "matched" && (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-6 py-4 text-sm font-medium text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
                <FiCheckCircle className="h-4 w-4" />
                Match found! Loading game…
              </div>
            )}

            {lobbyState === "error" && (
              <>
                <div className="flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  <FiAlertCircle className="h-4 w-4 flex-shrink-0" />
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function TimeControlPicker({
  selectedId,
  onSelect,
  customMinutes,
  customIncrementSeconds,
  onCustomMinutesChange,
  onCustomIncrementChange,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  customMinutes: string;
  customIncrementSeconds: string;
  onCustomMinutesChange: (value: string) => void;
  onCustomIncrementChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {TIME_PRESETS.map((preset) => {
          const Icon = CATEGORY_ICON[preset.category];
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-sm transition ${selectedId === preset.id
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600"
                }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-semibold">{preset.label}</span>
              <span
                className={`text-xs ${selectedId === preset.id
                  ? "text-neutral-300 dark:text-neutral-600"
                  : "text-neutral-400 dark:text-neutral-500"
                  }`}
              >
                {preset.category}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelect(CUSTOM_ID)}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm transition ${selectedId === CUSTOM_ID
            ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
            : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600"
            }`}
        >
          <FiSliders className="h-4 w-4" />
          <span className="font-semibold">Custom</span>
        </button>
      </div>

      {selectedId === CUSTOM_ID && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <label className="flex flex-1 items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Minutes
            <input
              type="number"
              min={MIN_CUSTOM_MINUTES}
              max={MAX_CUSTOM_MINUTES}
              value={customMinutes}
              onChange={(e) => onCustomMinutesChange(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Increment
            <input
              type="number"
              min={0}
              max={MAX_CUSTOM_INCREMENT_SECONDS}
              value={customIncrementSeconds}
              onChange={(e) => onCustomIncrementChange(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function RatedToggle({ rated, onChange }: { rated: boolean; onChange: (rated: boolean) => void }) {
  return (
    <div className="flex w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 px-3 py-2 text-sm font-medium transition ${rated
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-white text-neutral-500 hover:text-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
      >
        Rated
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 px-3 py-2 text-sm font-medium transition ${!rated
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-white text-neutral-500 hover:text-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
      >
        Casual
      </button>
    </div>
  );
}
