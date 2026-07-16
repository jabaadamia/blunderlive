"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { SiteNav } from "@/components/site-nav";
import { getErrorMessage } from "@/features/auth/lib/api-errors";
import { useAuth } from "@/providers/auth-provider";
import type { Rating } from "@/features/auth/types";
import {
  getUserGames,
  getUserRatingHistory,
  getUserRatings,
  RATING_CATEGORIES,
  type GameSummary,
  type RatingHistoryEntry,
} from "@/features/profile/lib/profile-api";

type ProfilePageProps = {
  userId: string;
};

function formatCategory(category: string) {
  return category.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function pickDefaultCategory(ratings: Rating[]) {
  const activeRatings = ratings.filter((rating) => rating.games_played > 0);
  const candidates = activeRatings.length > 0 ? activeRatings : ratings;
  const [bestRating] = [...candidates].sort((a, b) => {
    if (b.games_played !== a.games_played) {
      return b.games_played - a.games_played;
    }

    return b.value - a.value;
  });

  return bestRating?.category ?? RATING_CATEGORIES[0];
}

function getPlayerUsername(game: GameSummary, userId: string) {
  if (game.white_player?.id === userId) return game.white_player.username;
  if (game.black_player?.id === userId) return game.black_player.username;
  return null;
}

function getOpponent(game: GameSummary, userId: string) {
  if (game.white_player?.id === userId) return game.black_player;
  if (game.black_player?.id === userId) return game.white_player;
  return null;
}

function getGameScore(game: GameSummary, userId: string) {
  const isWhite = game.white_player?.id === userId;

  if (game.result === "1/2-1/2") return "Draw";
  if (game.result === "1-0") return isWhite ? "Won" : "Lost";
  if (game.result === "0-1") return isWhite ? "Lost" : "Won";
  return game.result;
}

function getScoreColor(score: string) {
  if (score === "Won") return "text-emerald-600 dark:text-emerald-400";
  if (score === "Lost") return "text-red-500 dark:text-red-400";
  return "text-neutral-500 dark:text-neutral-400";
}

function formatChartDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function toDateKey(isoString: string) {
  // Extract YYYY-MM-DD from ISO timestamp
  return isoString.slice(0, 10);
}

function RatingChart({ history }: { history: RatingHistoryEntry[] }) {
  const data = useMemo(() => {
    // Sort chronologically
    const sorted = [...history].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Group by day, keep only the last entry per day (end-of-day rating)
    const byDay = new Map<string, number>();
    for (const entry of sorted) {
      byDay.set(toDateKey(entry.created_at), entry.new_value);
    }

    return Array.from(byDay.entries()).map(([dateKey, rating]) => ({
      date: formatChartDate(dateKey),
      rating,
    }));
  }, [history]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        No rating history for this category yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-foreground)"
            opacity={0.08}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-foreground)", opacity: 0.5 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={["dataMin - 20", "dataMax + 20"]}
            tick={{ fontSize: 11, fill: "var(--color-foreground)", opacity: 0.5 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-background)",
              border: "1px solid var(--color-foreground)",
              borderRadius: "8px",
              fontSize: "13px",
              opacity: 0.95,
            }}
            labelStyle={{ color: "var(--color-foreground)", opacity: 0.6, fontSize: "11px" }}
            itemStyle={{ color: "#f59e0b" }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#f59e0b", stroke: "#fbbf24", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfilePage({ userId }: ProfilePageProps) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [history, setHistory] = useState<RatingHistoryEntry[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [nextGamesUrl, setNextGamesUrl] = useState<string | null>(null);
  const [inferredUsername, setInferredUsername] = useState<string | null>(null);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingRatings, setIsLoadingRatings] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingMoreGames, setIsLoadingMoreGames] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRatings() {
      setIsLoadingRatings(true);
      setRatingsError(null);

      try {
        const response = await getUserRatings(userId);

        if (!isMounted) return;

        setRatings(response);
        setSelectedCategory((currentCategory) => {
          if (currentCategory) return currentCategory;
          return pickDefaultCategory(response);
        });
      } catch (error) {
        if (isMounted) {
          setRatingsError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingRatings(false);
        }
      }
    }

    void loadRatings();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const currentCategory = selectedCategory;
    let isMounted = true;

    async function loadProfileDetail() {
      setIsLoadingDetail(true);
      setDetailError(null);
      setGames([]);
      setNextGamesUrl(null);

      try {
        const [historyResponse, gamesResponse] = await Promise.all([
          getUserRatingHistory(userId, currentCategory),
          getUserGames(userId, currentCategory),
        ]);

        if (!isMounted) return;

        setHistory(historyResponse);
        setGames(gamesResponse.results);
        setNextGamesUrl(gamesResponse.next);

        const firstUsername = gamesResponse.results
          .map((game) => getPlayerUsername(game, userId))
          .find(Boolean);

        if (firstUsername) {
          setInferredUsername(firstUsername);
        }
      } catch (error) {
        if (isMounted) {
          setDetailError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadProfileDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, userId]);

  const loadMoreGames = useCallback(async () => {
    const currentNextUrl = nextGamesUrl;
    const currentCategory = selectedCategory;

    if (!currentNextUrl || !currentCategory || isLoadingMoreGames) {
      return;
    }

    setIsLoadingMoreGames(true);
    setDetailError(null);

    try {
      const response = await getUserGames(userId, currentCategory, currentNextUrl);
      setGames((currentGames) => [...currentGames, ...response.results]);
      setNextGamesUrl(response.next);

      const firstUsername = response.results
        .map((game) => getPlayerUsername(game, userId))
        .find(Boolean);

      if (firstUsername) {
        setInferredUsername(firstUsername);
      }
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setIsLoadingMoreGames(false);
    }
  }, [isLoadingMoreGames, nextGamesUrl, selectedCategory, userId]);

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !nextGamesUrl) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMoreGames();
      }
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [loadMoreGames, nextGamesUrl]);

  const selectedRating = ratings.find(
    (rating) => rating.category === selectedCategory,
  );
  
  const resolvedUsername = user?.id === userId ? user.username : inferredUsername;
  const displayName = resolvedUsername ?? `User ${userId.slice(0, 8)}`;
  
  const categoryButtons = RATING_CATEGORIES.filter((category) =>
    ratings.some((rating) => rating.category === category),
  );
  const visibleCategories =
    categoryButtons.length > 0 ? categoryButtons : [...RATING_CATEGORIES];

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <SiteNav />

        {/* Header */}
        <header className="pt-4 pb-2">
          <p className="text-xs uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500">
            Profile
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight">
            {displayName}
          </h1>
        </header>

        {ratingsError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {ratingsError}
          </p>
        ) : null}

        {/* Category Tabs */}
        <nav className="flex flex-wrap gap-2">
          {visibleCategories.map((category) => {
            const isActive = selectedCategory === category;
            const ratingForCategory = ratings.find(
              (r) => r.category === category,
            );
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`flex flex-col items-center rounded-lg px-5 py-3 text-center transition ${
                  isActive
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                <span className="text-sm font-bold uppercase tracking-wide capitalize">
                  {formatCategory(category)}
                </span>
                {ratingForCategory && (
                  <span
                    className={`mt-0.5 text-lg font-semibold tabular-nums ${
                      isActive
                        ? "text-white/90"
                        : "text-neutral-900 dark:text-neutral-100"
                    }`}
                  >
                    {ratingForCategory.value}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rating Chart */}
        <section>
          <h2 className="text-base font-semibold text-neutral-700 dark:text-neutral-300">
            Rating History
            {selectedCategory && (
              <span className="ml-2 text-sm font-normal capitalize text-neutral-400 dark:text-neutral-500">
                {formatCategory(selectedCategory)}
              </span>
            )}
          </h2>
          <div className="mt-3">
            {isLoadingRatings || isLoadingDetail ? (
              <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                Loading chart…
              </div>
            ) : (
              <RatingChart history={history} />
            )}
          </div>
        </section>

        {/* Games List */}
        <section>
          <h2 className="text-base font-semibold text-neutral-700 dark:text-neutral-300">
            Games
            {selectedRating != null && (
              <span className="ml-2 text-sm font-normal text-neutral-400 dark:text-neutral-500">
                {selectedRating.games_played} played
              </span>
            )}
          </h2>

          {detailError ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {detailError}
            </p>
          ) : null}

          {isLoadingDetail ? (
            <p className="mt-4 text-sm text-neutral-500">Loading games…</p>
          ) : games.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              No games found for this category.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {games.map((game) => {
                const opponent = getOpponent(game, userId);
                const score = getGameScore(game, userId);

                return (
                  <Link
                    key={game.id}
                    href={`/game-history/${game.id}`}
                    className="group flex items-center justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3 transition hover:border-amber-300 hover:bg-amber-50/50 dark:border-neutral-800 dark:hover:border-amber-700/60 dark:hover:bg-amber-950/15"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className={getScoreColor(score)}>{score}</span>
                        <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">
                          vs
                        </span>
                        {opponent?.username ?? "Unknown"}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDate(game.started_at)} · {game.time_control} ·{" "}
                        {game.move_count} moves
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                      {game.result}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <div ref={loadMoreRef} className="h-8" />
          {isLoadingMoreGames ? (
            <p className="text-center text-sm text-neutral-500">
              Loading more games…
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
