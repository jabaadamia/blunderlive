"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  /** Authoritative remaining time (ms) as of `syncedAt`. */
  remainingMs: number;
  /** Whether this side's clock is currently the one ticking. */
  isRunning: boolean;
  /** Client-side Date.now() timestamp when `remainingMs` was received. */
  syncedAt: number;
  /** Below this threshold, render in a low-time warning style. */
  lowTimeThresholdMs?: number;
}

const TICK_INTERVAL_MS = 250;
const DEFAULT_LOW_TIME_THRESHOLD_MS = 10_000;

export function Timer({
  remainingMs,
  isRunning,
  syncedAt,
  lowTimeThresholdMs = DEFAULT_LOW_TIME_THRESHOLD_MS,
}: TimerProps) {
  const [displayMs, setDisplayMs] = useState(remainingMs);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const update = () => {
      const elapsed = Date.now() - syncedAt;
      setDisplayMs(Math.max(0, remainingMs - elapsed));
    };

    // Schedule first tick asynchronously to avoid synchronous setState in effect body.
    const firstTick = setTimeout(update, 0);
    const interval = setInterval(update, TICK_INTERVAL_MS);

    return () => {
      clearTimeout(firstTick);
      clearInterval(interval);
    };
  }, [isRunning, remainingMs, syncedAt]);

  // When not running, show authoritative remaining time from props directly.
  const shownMs = isRunning ? displayMs : remainingMs;

  const isLowTime = isRunning && shownMs <= lowTimeThresholdMs;

  return (
    <div
      className={`flex items-center justify-center rounded-md border px-3 py-1.5 font-mono text-lg tabular-nums transition-colors ${isLowTime
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          : isRunning
            ? "border-primary bg-primary text-primary-text"
            : "border-line bg-surface text-ink-muted"
        }`}
    >
      {formatDuration(shownMs)}
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${minutes}:${pad(seconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

