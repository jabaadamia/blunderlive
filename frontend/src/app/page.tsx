"use client";

import Link from "next/link";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useAuth } from "@/providers/auth-provider";
import { SiteNav } from "@/components/site-nav";

function HomeContent() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <SiteNav />
        <div className="flex flex-col items-center justify-center py-32">
          {isAuthenticated ? (
            <Link
              href="/matchmaking"
              style={{ color: "black" }}
              className="rounded-lg bg-white px-8 py-4 text-lg font-bold shadow-md transition hover:bg-neutral-100 dark:bg-neutral-100 dark:hover:bg-neutral-200"
            >
              Play Now
            </Link>
          ) : (
            <div className="text-neutral-600 dark:text-neutral-400">
              Please sign in to play.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
