"use client";

type JwtPayload = {
  exp?: number;
  user_id?: string;
  sub?: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
}

export function decodeJwtPayload(token: string) {
  try {
    const [, payload = ""] = token.split(".");
    return JSON.parse(atob(decodeBase64Url(payload))) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiry(token: string) {
  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}

export function getTokenUserId(token: string) {
  const payload = decodeJwtPayload(token);
  return payload?.user_id ?? payload?.sub ?? null;
}
