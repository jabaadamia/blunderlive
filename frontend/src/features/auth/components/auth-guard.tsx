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
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 text-sm text-ink-secondary">
        Checking your session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 text-sm text-ink-secondary">
        Redirecting to sign in...
      </div>
    );
  }

  return <>{children}</>;
}
