"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * List pages keep their filters, search and page in the URL, so a link (or the back button)
 * brings the admin to exactly the same view. Callers must sit inside <Suspense>.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((key: string) => params.get(key) ?? undefined, [params]);

  const set = useCallback(
    (next: Record<string, string | number | null | undefined>, { resetPage = true } = {}) => {
      const sp = new URLSearchParams(params);
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === undefined || value === "") sp.delete(key);
        else sp.set(key, String(value));
      }
      if (resetPage && !("page" in next)) sp.delete("page");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const page = Math.max(1, Number(params.get("page")) || 1);
  return { get, set, page };
}
