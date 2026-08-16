"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { getErrorMessage } from "@/features/auth/lib/api-errors";
import type { Rating } from "@/features/auth/types";
import { useAuth } from "@/providers/auth-provider";

function formatNullableNumber(value: number | null, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "—";
}

export function RatingsDashboard() {
  const { getMyRatings } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadRatings() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getMyRatings();

        if (isMounted) {
          setRatings(response);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRatings();

    return () => {
      isMounted = false;
    };
  }, [getMyRatings]);

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink-strong">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <SiteNav />

        <header className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.08em] text-ink-muted">
              BlunderLive
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Account overview</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              Your session is active. Ratings below are loaded from
              <span className="font-mono"> /api/ratings/me/</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-700 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Play
            </Link>
          </div>
        </header>

        <section className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">My ratings</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                This is mainly here so we can confirm the authenticated API flow is working.
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-ink-secondary">
              Loading ratings...
            </p>
          ) : error ? (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : ratings.length === 0 ? (
            <p className="mt-6 text-sm text-ink-secondary">
              No ratings were returned for this user yet.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Rating</th>
                    <th className="px-3 py-2 font-medium">Games</th>
                    <th className="px-3 py-2 font-medium">Deviation</th>
                    <th className="px-3 py-2 font-medium">Volatility</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((rating) => (
                    <tr
                      key={rating.category}
                      className="border-b border-surface-muted last:border-b-0 dark:border-line"
                    >
                      <td className="px-3 py-3 font-medium capitalize">
                        {rating.category.replaceAll("_", " ")}
                      </td>
                      <td className="px-3 py-3">{rating.value}</td>
                      <td className="px-3 py-3">{rating.games_played}</td>
                      <td className="px-3 py-3">
                        {formatNullableNumber(rating.deviation, 2)}
                      </td>
                      <td className="px-3 py-3">
                        {formatNullableNumber(rating.volatility, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
