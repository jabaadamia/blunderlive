"use client";

import { CORE_API_BASE, FRONTEND_AUTH_API_BASE } from "@/lib/api";

import { ApiError, toErrorBody } from "./api-errors";
import { getTokenExpiry } from "./jwt";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token-storage";
import type {
  AuthTokenResponse,
  LoginPayload,
  Rating,
  RegisterPayload,
} from "../types";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;
const TOKEN_REFRESH_SKEW_MS = 60_000;

type AuthHandledResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: unknown;
    };

function createHeaders(init?: HeadersInit) {
  const headers = new Headers(init);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return headers;
}

export function isTokenFresh(token: string, skewMs = TOKEN_REFRESH_SKEW_MS) {
  const expiry = getTokenExpiry(token);

  if (!expiry) {
    return false;
  }

  return expiry - Date.now() > skewMs;
}

export function getTokenRefreshDelay(token: string, skewMs = TOKEN_REFRESH_SKEW_MS) {
  const expiry = getTokenExpiry(token);

  if (!expiry) {
    return 0;
  }

  return Math.max(expiry - Date.now() - skewMs, 0);
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  const text = await response.text();
  return text || null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth = false, retryOnUnauthorized = true, headers, ...init } = options;
  const requestHeaders = createHeaders(headers);

  let requestBody: BodyInit | null | undefined = body as BodyInit | null | undefined;

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  if (!skipAuth) {
    const token = await getUsableAccessToken();

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(path, {
    ...init,
    headers: requestHeaders,
    body: requestBody,
    credentials: "include",
  });

  if (response.status === 401 && !skipAuth && retryOnUnauthorized) {
    const refreshedToken = await refreshAccessToken();

    if (refreshedToken) {
      return request<T>(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    }
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      toErrorBody(responseBody),
    );
  }

  return responseBody as T;
}

async function requestHandledAuth<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...init } = options;
  const requestHeaders = createHeaders(headers);

  let requestBody: BodyInit | null | undefined = body as BodyInit | null | undefined;

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(path, {
    ...init,
    headers: requestHeaders,
    body: requestBody,
    credentials: "include",
  });

  const responseBody = (await parseResponseBody(response)) as AuthHandledResponse<T>;

  if (!response.ok) {
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      toErrorBody(responseBody),
    );
  }

  if (!responseBody.ok) {
    throw new ApiError(
      `Request failed with status ${responseBody.status}`,
      responseBody.status,
      toErrorBody(responseBody.error),
    );
  }

  return responseBody.data;
}

export async function refreshAccessToken() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await requestHandledAuth<AuthTokenResponse>(
        `${FRONTEND_AUTH_API_BASE}/refresh-token/`,
        {
          method: "POST",
        },
      );

      setAccessToken(response.access);
      return response.access;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function getUsableAccessToken() {
  const token = getAccessToken();

  if (token && isTokenFresh(token)) {
    return token;
  }

  return refreshAccessToken();
}

export async function login(payload: LoginPayload) {
  const response = await requestHandledAuth<AuthTokenResponse>(
    `${FRONTEND_AUTH_API_BASE}/login/`,
    {
      method: "POST",
      body: payload,
    },
  );

  setAccessToken(response.access);
  return response.access;
}

export async function register(payload: RegisterPayload) {
  const response = await requestHandledAuth<AuthTokenResponse>(
    `${FRONTEND_AUTH_API_BASE}/register/`,
    {
      method: "POST",
      body: {
        username: payload.username,
        email: payload.email,
        password: payload.password,
        password_confirm: payload.passwordConfirm,
      },
    },
  );

  setAccessToken(response.access);
  return response.access;
}

export async function logout() {
  try {
    await requestHandledAuth<null>(`${FRONTEND_AUTH_API_BASE}/logout/`, {
      method: "POST",
    });
  } finally {
    clearAccessToken();
  }
}

export async function getMyRatings() {
  return request<Rating[]>(`${CORE_API_BASE}/ratings/me/`);
}

export async function getMyProfile() {
  return request<{ id: string; username: string }>(`${CORE_API_BASE}/users/me/`);
}
