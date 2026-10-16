import { NextResponse, type NextRequest } from "next/server";
import { apiBase, errorJson, setSessionCookies } from "@/lib/server/backend";

/** Logs in against the API and keeps the tokens in httpOnly cookies. Admins only. */
export async function POST(request: NextRequest) {
  const { identifier, password } = await request.json().catch(() => ({}));
  if (typeof identifier !== "string" || typeof password !== "string") {
    return errorJson(400, "VALIDATION_ERROR", "أدخل البريد الإلكتروني وكلمة المرور");
  }

  const res = await fetch(`${apiBase()}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);

  if (res.status === 401) return errorJson(401, "INVALID_CREDENTIALS", "البريد الإلكتروني أو كلمة المرور غير صحيحة");
  if (res.status === 429) return errorJson(429, "TOO_MANY_REQUESTS", "محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى");
  if (!res.ok || !body?.success) {
    return errorJson(res.status || 502, body?.error?.code ?? "LOGIN_FAILED", body?.error?.message ?? "تعذّر تسجيل الدخول");
  }

  const { user, accessToken, refreshToken } = body.data;
  if (!user.roles?.includes("SUPER_ADMIN")) {
    // Valid account, wrong place: end that session on the API so the token isn't left alive.
    await fetch(`${apiBase()}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` } });
    return errorJson(403, "NOT_ADMIN", "هذا الحساب ليس له صلاحية دخول لوحة الإدارة");
  }

  const response = NextResponse.json({ success: true, data: { user } });
  setSessionCookies(response, { accessToken, refreshToken });
  return response;
}
