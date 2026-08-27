"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout, status, user } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-ink transition hover:text-ink-secondary dark:text-ink dark:hover:text-ink-secondary"
        >
          <Image src="/logo_no_bg.png" alt="BlunderLive" width={1312} height={1199} className="h-10 w-auto" priority />
          <span className="hidden sm:inline">Blunderlive</span>
        </Link>
        <Link
          href="/analysis"
          className="text-sm font-medium text-ink-secondary transition hover:text-ink dark:text-ink-muted dark:hover:text-ink"
        >
          Analysis
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {status === "loading" ? (
          <span className="whitespace-nowrap text-sm text-ink-muted">
            Checking session...
          </span>
        ) : isAuthenticated ? (
          <>
            {user && (
              <Link
                href={`/profile/${user.id}`}
                className="whitespace-nowrap text-sm font-medium text-ink hover:underline dark:text-ink"
              >
                {user.username}
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:bg-surface-muted dark:text-ink"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="whitespace-nowrap text-sm text-ink-secondary transition hover:text-ink dark:text-ink-secondary dark:hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-text transition hover:bg-primary-hover dark:bg-surface-muted dark:text-white dark:hover:bg-surface-strong"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
