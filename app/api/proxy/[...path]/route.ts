import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  apiBase,
  clearSessionCookies,
  errorJson,
  refreshTokens,
  setSessionCookies,
  type Tokens,
} from "@/lib/server/backend";

/**
 * Same-origin proxy to the Brandak API. Attaches the access token from the httpOnly cookie,
 * and on a 401 refreshes once and retries. The browser never sees a token.
 */
async function handle(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${apiBase()}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  const send = (token?: string) => {
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const idempotency = request.headers.get("idempotency-key");
    if (idempotency) headers.set("idempotency-key", idempotency);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(target, { method: request.method, headers, body, cache: "no-store" });
  };

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let rotated: Tokens | null = null;

  if (!access && refresh) {
    rotated = await refreshTokens(refresh);
    access = rotated?.accessToken;
  }
  if (!access) {
    const res = errorJson(401, "UNAUTHORIZED", "انتهت الجلسة، سجّل الدخول مرة أخرى");
    return res;
  }

  let upstream: Response;
  try {
    upstream = await send(access);
    if (upstream.status === 401 && refresh && !rotated) {
      rotated = await refreshTokens(refresh);
      if (rotated) upstream = await send(rotated.accessToken);
    }
  } catch {
    return errorJson(502, "API_UNREACHABLE", "تعذّر الوصول إلى الخادم. تحقق من الاتصال ثم أعد المحاولة");
  }

  const response = new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
  if (rotated) setSessionCookies(response, rotated);
  else if (upstream.status === 401) clearSessionCookies(response);
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
