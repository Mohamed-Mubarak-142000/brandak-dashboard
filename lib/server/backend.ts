import "server-only";
import type { NextResponse } from "next/server";

/** Server-only helpers for talking to the Brandak API and managing session cookies. */

export const ACCESS_COOKIE = "bk_access";
export const REFRESH_COOKIE = "bk_refresh";

const ACCESS_MAX_AGE = 15 * 60; // matches the API's JWT_ACCESS_TTL
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // matches JWT_REFRESH_TTL_DAYS

export function apiBase(): string {
  const base = process.env.API_BASE_URL;
  if (!base) throw new Error("API_BASE_URL is not configured");
  return base.replace(/\/+$/, "");
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookies(res: NextResponse, tokens: Tokens) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

/** Rotates the refresh token. Returns null when the session is no longer valid. */
export async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const res = await fetch(`${apiBase()}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.data as Tokens;
}

export function errorJson(status: number, code: string, message: string) {
  return Response.json({ success: false, error: { code, message } }, { status });
}
