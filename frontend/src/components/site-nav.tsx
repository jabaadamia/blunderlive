"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout, status } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="text-sm font-semibold text-neutral-900 transition hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
        >
          Home
        </Link>
        {pathname !== "/matchmaking" && isAuthenticated ? (
          <Link
            href="/matchmaking"
            className="text-sm text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            Play
          </Link>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {status === "loading" ? (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Checking session...
          </span>
        ) : isAuthenticated ? (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Sign out
          </button>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
