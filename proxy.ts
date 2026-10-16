import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: no session cookie → login page. The real check happens on every API call
 * (the proxy route forwards the token and the API verifies it and the admin role).
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("bk_refresh") || request.cookies.has("bk_access");
  const isLogin = request.nextUrl.pathname === "/login";

  if (!hasSession && !isLogin) {
    const url = new URL("/login", request.nextUrl);
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) return NextResponse.redirect(new URL("/payments", request.nextUrl));
  return NextResponse.next();
}

export const config = {
  // API routes do their own auth (and bodies stay out of proxy buffering).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp)$).*)"],
};
