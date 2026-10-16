import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, clearSessionCookies, refreshTokens, setSessionCookies } from "@/lib/server/backend";

/**
 * Rotates the session. The browser client calls this once (single-flight) when the proxy
 * answers 401, so parallel requests never present the same refresh token twice — the API treats
 * a reused refresh token as theft and revokes the whole session.
 */
export async function POST(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const rotated = refresh ? await refreshTokens(refresh).catch(() => null) : null;

  if (!rotated) {
    const response = NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "انتهت الجلسة، سجّل الدخول مرة أخرى" } },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, data: null });
  setSessionCookies(response, rotated);
  return response;
}
