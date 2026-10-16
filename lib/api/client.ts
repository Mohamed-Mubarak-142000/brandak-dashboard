/**
 * Browser-side API client. Every call goes through the same-origin `/api/proxy`, which attaches
 * the session; this module only unwraps the `{ success, data, meta }` envelope.
 */

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

async function request<T>(path: string, { method = "GET", body, query }: RequestOptions = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const url = `/api/proxy${path}${qs.size ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "لا يوجد اتصال بالإنترنت. تحقق من الشبكة ثم أعد المحاولة");
  }

  if (res.status === 204) return { data: null as T, meta: undefined };
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    if (res.status === 401 && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // Full reload on purpose: the session is gone, so no cached data should survive.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${next}`);
    }
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
};
