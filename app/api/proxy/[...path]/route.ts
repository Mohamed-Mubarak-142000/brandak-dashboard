import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, apiBase, errorJson } from "@/lib/server/backend";

/**
 * Same-origin proxy to the Brandak API. Attaches the access token from the httpOnly cookie;
 * the browser never sees a token. It never refreshes: on a 401 the client calls
 * `/api/auth/refresh` once for all in-flight requests and retries (see lib/api/client.ts).
 * Refreshing here raced — parallel requests rotated the same refresh token and the API's
 * reuse detection revoked the session.
 */
async function handle(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${apiBase()}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!access) return errorJson(401, "UNAUTHORIZED", "انتهت الجلسة، سجّل الدخول مرة أخرى");

  const headers = new Headers({ authorization: `Bearer ${access}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const idempotency = request.headers.get("idempotency-key");
  if (idempotency) headers.set("idempotency-key", idempotency);

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store" });
  } catch {
    return errorJson(502, "API_UNREACHABLE", "تعذّر الوصول إلى الخادم. تحقق من الاتصال ثم أعد المحاولة");
  }

  return new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
