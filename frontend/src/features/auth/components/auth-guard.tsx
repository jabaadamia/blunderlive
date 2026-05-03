"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";

export function AuthGuard({
  children,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, redirectTo, router, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
        Checking your session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
        Redirecting to sign in...
      </div>
    );
  }

  return <>{children}</>;
}
