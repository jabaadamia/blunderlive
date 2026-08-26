import { NextResponse } from "next/server";

const INTERNAL_CORE_URL = process.env.INTERNAL_CORE_URL ?? "http://core:8000";
const COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === "true";

type AuthProxySuccess<T> = {
  ok: true;
  data: T;
};

type AuthProxyFailure = {
  ok: false;
  status: number;
  error: unknown;
};

type AuthProxyResponse<T> = AuthProxySuccess<T> | AuthProxyFailure;

function getCoreAuthUrl(path: string) {
  return new URL(`/api/auth/${path}`, INTERNAL_CORE_URL);
}

async function parseUpstreamBody(response: Response) {
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

function readCookieMaxAge(setCookieHeader: string) {
  const match = setCookieHeader.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function readRefreshCookieValue(setCookieHeader: string) {
  const match = setCookieHeader.match(/(?:^|,\s*)refresh=([^;]*)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

export function applyRefreshCookie(response: NextResponse, setCookieHeader: string | null) {
  if (!setCookieHeader) {
    return;
  }

  const value = readRefreshCookieValue(setCookieHeader);

  if (value === null) {
    return;
  }

  const maxAge = readCookieMaxAge(setCookieHeader);

  response.cookies.set({
    name: "refresh",
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/auth-api/",
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  });
}

export function clearRefreshCookie(response: NextResponse) {
  response.cookies.set({
    name: "refresh",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/auth-api/",
    maxAge: 0,
  });
}

export async function postToCoreAuth<T>(
  path: string,
  options: {
    body?: string;
    refreshCookie?: string;
  } = {},
) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.refreshCookie) {
    headers.set("Cookie", `refresh=${encodeURIComponent(options.refreshCookie)}`);
  }

  const upstream = await fetch(getCoreAuthUrl(path), {
    method: "POST",
    headers,
    body: options.body,
    cache: "no-store",
  });

  const payload = await parseUpstreamBody(upstream);

  const result: AuthProxyResponse<T> = upstream.ok
    ? { ok: true, data: payload as T }
    : { ok: false, status: upstream.status, error: payload };

  return {
    result,
    setCookieHeader: upstream.headers.get("set-cookie"),
  };
}
