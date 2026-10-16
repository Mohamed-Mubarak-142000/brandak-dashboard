"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "./client";

/**
 * Admin action with consistent feedback: a success toast naming what happened, an error toast
 * with the API's message, and fresh data afterwards (queue counters included).
 */
export function useAction<TVars, TResult = unknown>({
  run,
  success,
  failure,
  invalidate = [],
  onDone,
}: {
  run: (vars: TVars) => Promise<TResult>;
  success: string | ((vars: TVars) => { title: string; description?: string });
  failure: string;
  invalidate?: QueryKey[];
  onDone?: (result: TResult, vars: TVars) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result, vars) => {
      const msg = typeof success === "string" ? { title: success } : success(vars);
      toast({ tone: "success", ...msg });
      for (const key of [...invalidate, ["queue-counts"]]) queryClient.invalidateQueries({ queryKey: key });
      onDone?.(result, vars);
    },
    onError: (e) => toast({ tone: "error", title: failure, description: e instanceof ApiError ? e.message : "أعد المحاولة بعد قليل." }),
  });
}
