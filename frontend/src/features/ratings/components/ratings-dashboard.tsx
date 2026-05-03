"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getErrorMessage } from "@/features/auth/lib/api-errors";
import type { Rating } from "@/features/auth/types";
import { useAuth } from "@/providers/auth-provider";

function formatNullableNumber(value: number | null, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "—";
}

export function RatingsDashboard() {
  const router = useRouter();
  const { getMyRatings, logout } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.08em] text-neutral-500">
              BlunderLive
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Account overview</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Your session is active. Ratings below are loaded from
              <span className="font-mono"> /api/ratings/me/</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 px-4 text-sm font-medium transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">My ratings</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                This is mainly here so we can confirm the authenticated API flow is working.
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-300">
              Loading ratings...
            </p>
          ) : error ? (
            <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : ratings.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-300">
              No ratings were returned for this user yet.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
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
                      className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800"
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
