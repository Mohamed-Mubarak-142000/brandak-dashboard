"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Gavel, ImagePlus, Loader2, Send, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import { useAction } from "@/lib/api/use-action";
import type { TicketDetail as TicketView, TicketOutcome } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/format";
import { DetailList, DetailRow, Muted, Panel } from "@/components/data/detail-list";
import { PageHeader, PageShell } from "@/components/data/page-header";
import { PhotoStrip } from "@/components/data/photo-strip";
import { chip } from "@/components/promotions/promo-status";
import { Badge, TICKET_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { AUTHOR_LABEL, isActiveTicket, MAX_STRIKES, OUTCOME_LABEL, TICKET_TYPE } from "./ticket-labels";

/** Re-renders every minute so a countdown stays current without refetching. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** «باقي 31 ساعة على رد المتجر», or that the window passed (the next list load escalates it). */
export function StoreDeadline({ deadline, compact }: { deadline: string; compact?: boolean }) {
  const now = useNow();
  const left = new Date(deadline).getTime() - now;
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.max(0, Math.floor((left % 3_600_000) / 60_000));
  const text =
    left <= 0
      ? "المهلة خلصت — هتتحول للحكم"
      : hours >= 1
        ? `باقي ${hours} ساعة${compact ? "" : " على رد المتجر"}`
        : `باقي ${minutes} دقيقة${compact ? "" : " على رد المتجر"}`;
  return (
    <span title={`آخر ميعاد: ${formatDateTime(deadline)}`} className={cn("inline-flex items-center gap-1 text-meta", left <= 0 ? "text-danger" : hours < 12 ? "text-warning" : "text-ink-3")}>
      <Clock aria-hidden className="size-3.5" />
      <span className="num">{text}</span>
    </span>
  );
}

const BUBBLE: Record<string, string> = {
  CUSTOMER: "me-auto border-line bg-surface",
  BRAND: "me-auto border-accent/20 bg-accent-soft/50",
  ADMIN: "ms-auto border-brand/30 bg-sunken",
};

/** The conversation: customer and store on the start side, Fatrina support on the end side. */
function Thread({ ticket }: { ticket: TicketView }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [ticket.messages.length]);
  return (
    <ol className="flex flex-col gap-3">
      {ticket.messages.map((m, i) => (
        <li key={m.id ?? i} className={cn("max-w-[85%] rounded-md border px-4 py-3", BUBBLE[m.author])}>
          <p className="mb-1 flex flex-wrap items-baseline gap-x-2 text-meta">
            <span className={cn("font-semibold", m.author === "ADMIN" ? "text-accent" : "text-ink")}>
              {m.author === "CUSTOMER" ? ticket.userName : m.author === "BRAND" ? ticket.brandName || AUTHOR_LABEL.BRAND : AUTHOR_LABEL.ADMIN}
            </span>
            {m.author !== "ADMIN" && <span className="text-ink-3">{AUTHOR_LABEL[m.author]}</span>}
            <time dateTime={m.at} title={formatDateTime(m.at)} className="text-ink-3">
              {formatRelative(m.at)}
            </time>
          </p>
          <p className="whitespace-pre-line text-ui leading-relaxed text-ink">{m.text}</p>
          {m.images.length > 0 && (
            <div className="mt-3">
              <PhotoStrip urls={m.images} label="صور الرسالة" size={64} />
            </div>
          )}
        </li>
      ))}
      <li ref={end} aria-hidden />
    </ol>
  );
}

const MAX_PHOTOS = 4;
const MAX_BYTES = 4 * 1024 * 1024;

function ReplyBox({ ticket }: { ticket: TicketView }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  // Screenshots or photos for the customer/store (e.g. where to find a setting).
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    const picked = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    for (const file of picked) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setUploadError("الصور لازم تكون JPG أو PNG أو WEBP");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setUploadError("الصورة أكبر من 4 ميجا");
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const res = await api.upload(file, "CLAIM_IMAGE");
        setPhotos((p) => [...p, { id: res.id, url: res.url ?? URL.createObjectURL(file) }]);
      } catch {
        setUploadError("لم يتم رفع الصورة. تأكد من الاتصال وجرّب تاني");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const reply = useAction({
    run: (body: { text: string; imageFileIds?: string[] }) => api.post<TicketView>(`/admin/tickets/${ticket.id}/messages`, body),
    success: "تم إرسال الرد",
    failure: "لم يتم إرسال الرد",
    invalidate: [["tickets", "list"]],
    onDone: (saved) => {
      queryClient.setQueryData(qk.ticket(ticket.id), saved);
      setText("");
      setPhotos([]);
    },
  });
  const trimmed = text.trim();
  const send = () => {
    if (trimmed && !uploading) reply.mutate({ text: trimmed, imageFileIds: photos.length ? photos.map((p) => p.id) : undefined });
  };
  return (
    <form
      className="mt-5 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <Field label="رد دعم فاترينة" hint={ticket.protection ? "الرد بيوصل للعميل وللمتجر." : "الرد بيوصل للعميل."}>
        {(a11y) => (
          <Textarea
            {...a11y}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
            }}
            placeholder="اكتب ردك هنا…"
          />
        )}
      </Field>
      {(photos.length > 0 || uploading > 0) && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="الصور المرفقة">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded preview from the API host */}
              <img src={p.url} alt="" className="size-16 rounded-sm border border-line object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full border border-line bg-surface text-ink-2 hover:text-danger"
                aria-label="شيل الصورة"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`up-${i}`} className="grid size-16 place-items-center rounded-sm border border-line bg-sunken">
              <Loader2 aria-hidden className="size-5 animate-spin text-ink-3" />
              <span className="sr-only">جاري رفع الصورة</span>
            </li>
          ))}
        </ul>
      )}
      {uploadError && (
        <p role="alert" className="mt-2 text-meta text-danger">
          {uploadError}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void addPhotos(e.target.files)} />
          <Button type="button" variant="ghost" size="sm" disabled={photos.length + uploading >= MAX_PHOTOS} onClick={() => fileInput.current?.click()}>
            <ImagePlus aria-hidden className="size-4" />
            إرفاق صور <span className="num text-ink-3">({photos.length}/{MAX_PHOTOS})</span>
          </Button>
          <span className="num text-meta text-ink-3">{text.length}/2000</span>
        </div>
        <Button type="submit" variant="primary" loading={reply.isPending} disabled={!trimmed || uploading > 0}>
          <Send aria-hidden className="size-4 rtl:-scale-x-100" />
          إرسال الرد
        </Button>
      </div>
    </form>
  );
}

const OUTCOMES: { value: TicketOutcome; hint: string }[] = [
  { value: "CUSTOMER", hint: "العميل معاه حق" },
  { value: "STORE", hint: "المتجر معاه حق" },
  { value: "NEUTRAL", hint: "الطرفين اتفقوا" },
];

/** The decision. For the customer on a protection case = a strike on the store. */
function ResolveDialog({ ticket, open, onOpenChange }: { ticket: TicketView; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<TicketOutcome | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const strike = ticket.protection && !!ticket.brandId && outcome === "CUSTOMER";
  const errors = { outcome: !outcome ? "اختار القرار" : undefined, note: note.trim().length < 3 ? "اكتب سبب القرار (بيوصل للعميل والمتجر)" : undefined };

  const close = () => {
    setOutcome(null);
    setNote("");
    setTouched(false);
    onOpenChange(false);
  };
  const resolve = useAction({
    run: (body: { outcome: TicketOutcome; note: string }) => api.post<TicketView>(`/admin/tickets/${ticket.id}/resolve`, body),
    success: (v) => ({ title: "تم الحكم في التذكرة", description: OUTCOME_LABEL[v.outcome] }),
    failure: "لم يتم حفظ القرار",
    // A strike can suspend the store, so its pages refresh too.
    invalidate: [["tickets"], ["brand"], ["brands"]],
    onDone: (saved) => {
      queryClient.setQueryData(qk.ticket(ticket.id), saved);
      close();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={`الحكم في ${ticket.number}`}
      description="القرار بيقفل التذكرة ويوصل إشعار للعميل وللمتجر."
      initialFocus={textarea}
      footer={
        <>
          <Button onClick={close} disabled={resolve.isPending}>
            إلغاء
          </Button>
          <Button
            variant={strike ? "danger" : "primary"}
            loading={resolve.isPending}
            onClick={() => {
              setTouched(true);
              if (outcome && !errors.note) resolve.mutate({ outcome, note: note.trim() });
            }}
          >
            {strike ? "احكم لصالح العميل" : "حفظ القرار"}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-ui font-medium text-ink">القرار</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {OUTCOMES.map((o) => (
            <label key={o.value} className={cn(chip, "h-auto flex-col py-2.5")}>
              <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="sr-only" />
              <span>{OUTCOME_LABEL[o.value]}</span>
              <span className="text-meta font-normal text-ink-3">{o.hint}</span>
            </label>
          ))}
        </div>
        {touched && errors.outcome && <p className="mt-1.5 text-meta text-danger">{errors.outcome}</p>}
      </fieldset>

      {ticket.protection && ticket.brandId && (
        <div className={cn("mt-4 rounded-sm border px-4 py-3 text-ui", strike ? "border-danger/30 bg-danger-soft" : "border-line bg-sunken")}>
          <p className={cn("font-semibold", strike ? "text-danger" : "text-ink")}>دي شكوى حماية مشتري</p>
          <p className="mt-1 text-ink">
            الحكم لصالح العميل بيسجل مخالفة على {ticket.brandName || "المتجر"}، ولما المتجر يوصل <span className="num font-semibold">{MAX_STRIKES}</span> مخالفات بيتوقف
            تلقائيًا.{" "}
            <Link href={`/brands/${ticket.brandId}`} target="_blank" className="text-accent underline-offset-4 hover:underline">
              شوف مخالفاته الحالية
            </Link>
          </p>
        </div>
      )}

      <div className="mt-4">
        <Field label="سبب القرار" error={touched ? errors.note : undefined}>
          {(a11y) => (
            <Textarea
              {...a11y}
              ref={textarea}
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: شركة الشحن أكدت إن الطلب متسلمش، والمتجر هيرجّع المبلغ للعميل."
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [resolving, setResolving] = useState(false);
  const ticket = useQuery({
    queryKey: qk.ticket(id),
    queryFn: () => api.get<TicketView>(`/admin/tickets/${id}`),
    // New messages from the customer or store show up while the page is open.
    refetchInterval: 30_000,
  });

  if (ticket.isPending) {
    return (
      <PageShell>
        <Skeleton className="h-9 w-64" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </PageShell>
    );
  }
  if (ticket.isError || !ticket.data) {
    return (
      <PageShell>
        <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
      </PageShell>
    );
  }

  const t = ticket.data;
  const s = TICKET_STATUS[t.status];
  const active = isActiveTicket(t.status);

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/support", label: "كل التذاكر" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.subject}
            <Badge tone={s.tone}>{s.label}</Badge>
          </span>
        }
        description={
          <>
            <span className="num">{t.number}</span> — فتحها {t.userName} {formatRelative(t.createdAt)}
          </>
        }
        actions={
          active && (
            <Button variant="primary" onClick={() => setResolving(true)}>
              <Gavel aria-hidden className="size-4" />
              احكم واقفل التذكرة
            </Button>
          )
        }
      />

      {t.status === "ESCALATED" && (
        <div className="mt-6 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-ui">
          <p className="font-semibold text-danger">محتاجة حكم</p>
          <p className="mt-1 text-ink">
            المتجر مردش خلال 48 ساعة{t.escalatedAt ? <> (اتحولت {formatRelative(t.escalatedAt)})</> : null}. راجع الكلام والصور واحكم.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <h2 className="mb-4 text-ui font-semibold text-ink">
            المحادثة <span className="num text-ink-3">({t.messages.length})</span>
          </h2>
          <Thread ticket={t} />
          {active ? (
            <ReplyBox ticket={t} />
          ) : (
            <p className="mt-5 border-t border-line pt-4 text-ui text-ink-3">التذكرة {t.status === "CLOSED" ? "مقفولة" : "اتحلت"}؛ مفيش ردود جديدة عليها.</p>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          {t.resolution && (
            <Panel className={t.resolution.outcome === "CUSTOMER" ? "border-success/30" : undefined}>
              <h2 className="flex items-center gap-2 text-ui font-semibold text-ink">
                <ShieldCheck aria-hidden className="size-4 text-success" />
                القرار: {OUTCOME_LABEL[t.resolution.outcome]}
              </h2>
              <p className="mt-2 whitespace-pre-line text-ui text-ink">{t.resolution.note}</p>
              <p className="mt-2 text-meta text-ink-3">{formatDateTime(t.resolution.at)}</p>
              {t.protection && t.resolution.outcome === "CUSTOMER" && t.brandId && (
                <p className="mt-2 text-meta text-ink-2">اتسجلت مخالفة حماية مشتري على المتجر.</p>
              )}
            </Panel>
          )}

          <Panel>
            <DetailList title="التفاصيل">
              <DetailRow label="النوع">
                {TICKET_TYPE[t.type]}
                {t.protection && <Badge tone="accent">حماية المشتري</Badge>}
              </DetailRow>
              <DetailRow label="الحالة">
                <Badge tone={s.tone}>{s.label}</Badge>
              </DetailRow>
              {t.status === "WAITING_STORE" && t.storeDeadline && (
                <DetailRow label="مهلة المتجر">
                  <StoreDeadline deadline={t.storeDeadline} />
                </DetailRow>
              )}
              <DetailRow label="العميل">{t.userName}</DetailRow>
              <DetailRow label="الطلب">
                {t.orderId ? (
                  <Link href={`/orders/${t.orderId}`} className="num text-accent underline-offset-4 hover:underline">
                    {t.orderNumber}
                  </Link>
                ) : (
                  <Muted>مش عن طلب معيّن</Muted>
                )}
              </DetailRow>
              <DetailRow label="المتجر">
                {t.brandId ? (
                  <Link href={`/brands/${t.brandId}`} className="text-accent underline-offset-4 hover:underline">
                    {t.brandName || "متجر"}
                  </Link>
                ) : (
                  <Muted>—</Muted>
                )}
              </DetailRow>
              <DetailRow label="اتفتحت">{formatDateTime(t.createdAt)}</DetailRow>
              <DetailRow label="آخر تحديث">{formatDateTime(t.updatedAt)}</DetailRow>
            </DetailList>
          </Panel>

          {t.protection && (
            <p className="text-meta text-ink-3">
              حماية المشتري: المتجر عنده 48 ساعة يرد على الشكوى. لو مردش بتتحول لفاترينة تحكم فيها. الحكم لصالح العميل بيسجل مخالفة على المتجر، و
              <span className="num">{MAX_STRIKES}</span> مخالفات بيوقفوه تلقائيًا.
            </p>
          )}
        </div>
      </div>

      {active && <ResolveDialog ticket={t} open={resolving} onOpenChange={setResolving} />}
    </PageShell>
  );
}
