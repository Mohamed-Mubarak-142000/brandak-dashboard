"use client";

import type { QueryKey } from "@tanstack/react-query";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/api/use-action";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { RowMenuItem } from "./row-menu";

interface Target {
  id: string;
  name: string;
}

/**
 * Soft delete + restore for one admin resource: `POST {base}/:id/delete` and `/restore`.
 * Deleting asks for confirmation; restoring runs straight away (it is itself the undo).
 *
 *   const del = useSoftDelete({ base: "/admin/brands", noun: "المتجر", invalidate: [["brands"]], warning: "…" });
 *   items: [...del.menuItems({ id, name }, !!row.deletedAt)]   and render {del.dialog}
 */
export function useSoftDelete({
  base,
  noun,
  invalidate,
  warning,
  onDone,
}: {
  base: string;
  /** "المتجر", "المستخدم", "التصنيف"… — used in titles and toasts. */
  noun: string;
  invalidate: QueryKey[];
  /** What deleting does, shown in the confirmation. */
  warning: string;
  onDone?: (action: "delete" | "restore") => void;
}) {
  const [confirming, setConfirming] = useState<Target | null>(null);

  const act = useAction({
    run: ({ target, action }: { target: Target; action: "delete" | "restore" }) => api.post(`${base}/${target.id}/${action}`, {}),
    success: ({ target, action }) => ({ title: action === "delete" ? `تم حذف ${noun}` : `تم استرجاع ${noun}`, description: target.name }),
    failure: "لم يتم تنفيذ الإجراء",
    invalidate,
    onDone: (_r, { action }) => {
      setConfirming(null);
      onDone?.(action);
    },
  });

  // Stable callbacks, so tables can keep memoised columns.
  const { mutate } = act;
  const askDelete = useCallback((target: Target) => setConfirming(target), []);
  const restore = useCallback((target: Target) => mutate({ target, action: "restore" }), [mutate]);

  const menuItems = (target: Target, deleted: boolean, opts: { disabled?: boolean } = {}): RowMenuItem[] =>
    deleted
      ? [{ label: `استرجاع ${noun}`, icon: ArchiveRestore, onSelect: () => restore(target), separated: true }]
      : [{ label: `حذف ${noun}`, icon: Trash2, onSelect: () => askDelete(target), danger: true, separated: true, disabled: opts.disabled }];

  const dialog = confirming ? (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && setConfirming(null)}
      title={`حذف ${noun}؟`}
      description={`${confirming.name}: ${warning} تقدر تسترجعه في أي وقت من فلتر "المحذوفة".`}
      confirmLabel={`حذف ${noun}`}
      tone="danger"
      loading={act.isPending}
      onConfirm={() => act.mutate({ target: confirming, action: "delete" })}
    />
  ) : null;

  return { askDelete, restore, menuItems, dialog, pending: act.isPending };
}

/** "الحالية / المحذوفة" filter section shared by the admin tables. */
export const DELETED_FILTER = {
  key: "deleted",
  label: "العرض",
  defaultValue: "no",
  options: [
    { value: "no", label: "الحالية" },
    { value: "yes", label: "المحذوفة", hint: "المحذوف مؤقتًا ويمكن استرجاعه" },
  ],
};
