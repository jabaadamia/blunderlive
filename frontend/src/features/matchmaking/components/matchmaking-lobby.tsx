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
import { useAuth } from "@/providers/auth-provider";
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
  const { isAuthenticated } = useAuth();
  const [lobbyState, setLobbyState] = useState<LobbyState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PRESET_ID);
  const [customMinutes, setCustomMinutes] = useState("5");
  const [customIncrementSeconds, setCustomIncrementSeconds] = useState("0");
  const [rated, setRated] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lobbyStateRef = useRef<LobbyState>("idle");

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
    lobbyStateRef.current = lobbyState;
  }, [lobbyState]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (lobbyStateRef.current === "joining" || lobbyStateRef.current === "queued") {
        leaveMatchmaking().catch(() => { });
      }
    };
  }, [stopPolling]);

  async function handlePlay() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }

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
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink-strong">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <SiteNav />

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm uppercase tracking-widest text-ink-muted">
              BlunderLive
            </p>
            <h1 className="text-4xl font-bold">Find a game</h1>
            <p className="mt-1 text-sm text-ink-muted">
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-text transition hover:bg-primary-hover"
                >
                  <FiPlay className="h-5 w-5" />
                  Play
                </button>
              </>
            )}

            {lobbyState === "joining" && (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-6 py-4 text-sm text-ink-secondary">
                <FiLoader className="h-4 w-4 animate-spin" />
                Joining queue…
              </div>
            )}

            {lobbyState === "queued" && (
              <>
                <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-6 py-4 text-sm text-ink-secondary">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Looking for an opponent…
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1 text-sm text-ink-muted underline-offset-4 hover:underline"
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
                  className="text-sm text-ink-muted underline-offset-4 hover:underline"
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
                ? "border-primary bg-primary text-primary-text"
                : "border-line bg-surface text-ink-secondary hover:border-ink-faint dark:hover:border-ink-on-primary"
                }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-semibold">{preset.label}</span>
              <span
                className={`text-xs ${selectedId === preset.id
                  ? "text-ink-on-primary"
                  : "text-ink-faint"
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
            ? "border-primary bg-primary text-primary-text"
            : "border-line bg-surface text-ink-secondary hover:border-ink-faint dark:hover:border-ink-on-primary"
            }`}
        >
          <FiSliders className="h-4 w-4" />
          <span className="font-semibold">Custom</span>
        </button>
      </div>

      {selectedId === CUSTOM_ID && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <label className="flex flex-1 items-center gap-2 text-sm text-ink-secondary">
            Minutes
            <input
              type="number"
              min={MIN_CUSTOM_MINUTES}
              max={MAX_CUSTOM_MINUTES}
              value={customMinutes}
              onChange={(e) => onCustomMinutesChange(e.target.value)}
              className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-ink dark:border-line-strong dark:bg-surface-muted"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-sm text-ink-secondary">
            Increment
            <input
              type="number"
              min={0}
              max={MAX_CUSTOM_INCREMENT_SECONDS}
              value={customIncrementSeconds}
              onChange={(e) => onCustomIncrementChange(e.target.value)}
              className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-ink dark:border-line-strong dark:bg-surface-muted"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function RatedToggle({ rated, onChange }: { rated: boolean; onChange: (rated: boolean) => void }) {
  return (
    <div className="flex w-full overflow-hidden rounded-lg border border-line">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 px-3 py-2 text-sm font-medium transition ${rated
          ? "bg-primary text-primary-text"
          : "bg-surface text-ink-muted hover:text-ink"
          }`}
      >
        Rated
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 px-3 py-2 text-sm font-medium transition ${!rated
          ? "bg-primary text-primary-text"
          : "bg-surface text-ink-muted hover:text-ink"
          }`}
      >
        Casual
      </button>
    </div>
  );
}
