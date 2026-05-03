"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";

export function AuthPageGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [router, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
        Preparing authentication...
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
        Redirecting...
      </div>
    );
  }

  return <>{children}</>;
}
