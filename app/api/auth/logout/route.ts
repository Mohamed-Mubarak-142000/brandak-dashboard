import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, apiBase, clearSessionCookies } from "@/lib/server/backend";

export async function POST(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    // Revoke the session on the API too; the cookie is cleared either way.
    await fetch(`${apiBase()}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${access}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ success: true, data: null });
  clearSessionCookies(response);
  return response;
}
