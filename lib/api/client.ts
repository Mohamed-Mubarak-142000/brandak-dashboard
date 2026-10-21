/**
 * Browser-side API client. Every call goes through the same-origin `/api/proxy`, which attaches
 * the session; this module only unwraps the `{ success, data, meta }` envelope.
 */

import type { UploadResult } from "./types";

export interface ErrorDetail {
  field?: string;
  reason: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  [extra: string]: unknown;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
}

/**
 * One refresh for every request that hit a 401 at the same time. The refresh token rotates on
 * each use and the API revokes the session if an old one is presented again, so concurrent
 * refreshes would log the admin out.
 */
let refreshing: Promise<boolean> | null = null;
function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", cache: "no-store" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

let redirecting = false;
function goToLogin() {
  if (redirecting || typeof window === "undefined") return;
  redirecting = true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // Clear the cookies first: with a cookie left behind the route proxy sends /login straight
  // back to /, which 401s again — an endless reload loop.
  void fetch("/api/auth/logout", { method: "POST" })
    .catch(() => undefined)
    .finally(() => {
      // Full reload on purpose: the session is gone, so no cached data should survive.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${next}`);
    });
}

async function request<T>(path: string, { method = "GET", body, query }: RequestOptions = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const url = `/api/proxy${path}${qs.size ? `?${qs}` : ""}`;

  const send = () =>
    fetch(url, {
      method,
      // FormData (file uploads) sets its own multipart content type.
      headers: body === undefined || body instanceof FormData ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      cache: "no-store",
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && (await refreshSession())) res = await send();
  } catch {
    throw new ApiError(0, "NETWORK", "لا يوجد اتصال بالإنترنت. تحقق من الشبكة ثم أعد المحاولة");
  }

  if (res.status === 204) return { data: null as T, meta: undefined };
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    if (res.status === 401) goToLogin();
    throw new ApiError(
      res.status,
      json?.error?.code ?? "UNKNOWN",
      json?.error?.message ?? "حدث خطأ غير متوقع",
      json?.error?.details,
    );
  }
  return { data: json.data as T, meta: json.meta as PageMeta | undefined };
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await request<T>(path, { query })).data,
  page: async <T>(path: string, query?: Query): Promise<Page<T>> => {
    const { data, meta } = await request<T[]>(path, { query });
    return { items: data, meta: meta as PageMeta };
  },
  post: async <T>(path: string, body: unknown = {}) => (await request<T>(path, { method: "POST", body })).data,
  patch: async <T>(path: string, body: unknown) => (await request<T>(path, { method: "PATCH", body })).data,
  put: async <T>(path: string, body: unknown) => (await request<T>(path, { method: "PUT", body })).data,
  /** Uploads one file (POST /uploads); send the returned `id` in the entity's *FileIds field. */
  upload: async (file: File, purpose: string) => {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", file);
    return (await request<UploadResult>("/uploads", { method: "POST", body: form })).data;
  },
};
