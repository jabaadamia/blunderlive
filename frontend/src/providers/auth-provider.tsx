"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/api";
import {
  getTokenRefreshDelay,
  getMyProfile,
  getMyRatings,
  getUsableAccessToken,
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

type UserProfile = {
  id: string;
  username: string;
};

type AuthContextValue = {
  status: AuthStatus;
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  getMyRatings: () => Promise<Rating[]>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

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
      const freshToken = await getUsableAccessToken();

      if (isActive) {
        syncAuthenticatedState(freshToken);
      }
    }

    void bootstrapSession();

    return () => {
      isActive = false;
    };
  }, [syncAuthenticatedState]);

  useEffect(() => {
    let isActive = true;
    async function loadUser() {
      if (accessToken) {
        try {
          const profile = await getMyProfile();
          if (isActive) {
            setUser(profile);
          }
        } catch {
          if (isActive) {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    }
    
    void loadUser();

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== ACCESS_TOKEN_STORAGE_KEY) {
        return;
      }

      syncAuthenticatedState(getAccessToken());
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncAuthenticatedState]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshSession();
    }, getTokenRefreshDelay(accessToken));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, refreshSession]);

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
      user,
      isAuthenticated: status === "authenticated",
      login: handleLogin,
      register: handleRegister,
      logout: handleLogout,
      refreshSession,
      getMyRatings,
    }),
    [accessToken, user, handleLogin, handleLogout, handleRegister, refreshSession, status],
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
