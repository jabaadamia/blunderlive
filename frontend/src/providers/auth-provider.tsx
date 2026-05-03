"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getMyRatings,
  login,
  logout,
  refreshAccessToken,
  register,
} from "@/features/auth/lib/auth-client";
import { getAccessToken } from "@/features/auth/lib/token-storage";
import type {
  AuthStatus,
  LoginPayload,
  Rating,
  RegisterPayload,
} from "@/features/auth/types";

type AuthContextValue = {
  status: AuthStatus;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  getMyRatings: () => Promise<Rating[]>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAccessToken() ? "authenticated" : "loading",
  );

  const syncAuthenticatedState = useCallback((token: string | null) => {
    setAccessToken(token);
    setStatus(token ? "authenticated" : "unauthenticated");
  }, []);

  const refreshSession = useCallback(async () => {
    const freshToken = await refreshAccessToken();
    syncAuthenticatedState(freshToken);
    return Boolean(freshToken);
  }, [syncAuthenticatedState]);

  useEffect(() => {
    let isActive = true;

    async function bootstrapSession() {
      const freshToken = await refreshAccessToken();

      if (isActive) {
        syncAuthenticatedState(freshToken);
      }
    }

    void bootstrapSession();

    return () => {
      isActive = false;
    };
  }, [syncAuthenticatedState]);

  const handleLogin = useCallback(
    async (payload: LoginPayload) => {
      const token = await login(payload);
      syncAuthenticatedState(token);
    },
    [syncAuthenticatedState],
  );

  const handleRegister = useCallback(
    async (payload: RegisterPayload) => {
      const token = await register(payload);
      syncAuthenticatedState(token);
    },
    [syncAuthenticatedState],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    syncAuthenticatedState(null);
  }, [syncAuthenticatedState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken,
      isAuthenticated: status === "authenticated",
      login: handleLogin,
      register: handleRegister,
      logout: handleLogout,
      refreshSession,
      getMyRatings,
    }),
    [accessToken, handleLogin, handleLogout, handleRegister, refreshSession, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
