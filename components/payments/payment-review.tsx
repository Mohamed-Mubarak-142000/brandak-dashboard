"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/queries";
import type { PaymentDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { BILLING_LABEL, formatDate, formatDateTime, formatMoney, formatPhone, formatRelative } from "@/lib/format";
import { Badge, BRAND_STATUS, PAYMENT_STATUS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { isTyping, ReceiptViewer } from "./receipt-viewer";
import { RejectDialog } from "./reject-dialog";

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`نسخ ${label}`}
      onClick={async () => {
        await navigator.clipboard?.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink"
    >
      {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
    </button>
  );
}

/** One label/value line of the comparison ledger. */
function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-3 border-b border-line py-3 last:border-b-0">
      <dt className="text-ui text-ink-2">{label}</dt>
      <dd className={cn("flex min-w-0 items-center gap-1 text-ink", strong ? "text-section font-semibold" : "text-body")}>
        {children}
      </dd>
    </div>
  );
}

export function PaymentReview({
  paymentId,
  onDecided,
  onBack,
}: {
  paymentId: string;
  /** Called after a decision so the desk can move to the next receipt. */
  onDecided: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [amountChecked, setAmountChecked] = useState(false);
  const [referenceChecked, setReferenceChecked] = useState(false);
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [stampAt, setStampAt] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: qk.payment(paymentId),
    queryFn: () => api.get<PaymentDetail>(`/admin/payments/${paymentId}`),
  });
  const payment = detail.data;
  const pending = payment?.status === "PENDING_REVIEW";
  const canApprove = pending && amountChecked && referenceChecked && !stampAt;

  const refreshQueues = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: qk.counts });
  };

  const handleError = (e: unknown) => {
    const err = e instanceof ApiError ? e : null;
    if (err?.code === "ALREADY_REVIEWED") {
      toast({ tone: "error", title: "تمت مراجعة هذا الإيصال بالفعل", description: "حدّثنا البيانات لتعرض القرار الحالي." });
      detail.refetch();
      refreshQueues();
      return;
    }
    if (err?.code === "REFERENCE_ALREADY_USED") {
      toast({
        tone: "error",
        title: "الرقم المرجعي مستخدم في دفعة معتمدة أخرى",
        description: "نفس التحويل لا يمكن أن يفعّل اشتراكين. ارفض هذا الإيصال واطلب إيصالًا صحيحًا.",
      });
      return;
    }
    toast({ tone: "error", title: "لم يتم حفظ القرار", description: err?.message ?? "أعد المحاولة بعد قليل." });
  };

  const approve = useMutation({
    mutationFn: () => api.post(`/admin/payments/${paymentId}/approve`, note.trim() ? { reviewNote: note.trim() } : {}),
    onSuccess: () => {
      setStampAt(new Date().toISOString());
      toast({ tone: "success", title: "تم اعتماد الدفع", description: `تم تفعيل اشتراك ${payment?.brandId.name}.` });
      refreshQueues();
      // Let the stamp land before moving on to the next receipt.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: qk.payment(paymentId) });
        onDecided();
      }, 1100);
    },
    onError: handleError,
  });

  const reject = useMutation({
    mutationFn: (reason: string) => api.post(`/admin/payments/${paymentId}/reject`, { reason }),
    onSuccess: () => {
      setRejecting(false);
      toast({ tone: "success", title: "تم رفض الإيصال", description: "وصل السبب إلى صاحب البراند." });
      refreshQueues();
      queryClient.invalidateQueries({ queryKey: qk.payment(paymentId) });
      onDecided();
    },
    onError: handleError,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || rejecting) return;
      const key = e.key.toLowerCase();
      if (key === "a" && canApprove && !approve.isPending) {
        e.preventDefault();
        approve.mutate();
      }
      if (key === "r" && pending && !stampAt) {
        e.preventDefault();
        setRejecting(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canApprove, pending, rejecting, stampAt, approve]);

  if (detail.isPending) return <ReviewSkeleton />;
  if (detail.isError || !payment) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;

  const brand = payment.brandId;
  const sub = payment.subscriptionId;
  const status = PAYMENT_STATUS[stampAt ? "APPROVED" : payment.status];
  const brandStatus = BRAND_STATUS[brand.status];
  const approvedAt = stampAt ?? (payment.status === "APPROVED" ? payment.reviewedAt : undefined);

  return (
    <article className="flex min-h-full flex-col" aria-labelledby="review-title">
      <header className="border-b border-line px-5 py-5 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="-ms-2 mb-3 inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-ui text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <ArrowRight aria-hidden className="size-4" />
          كل المدفوعات
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="review-title" className="font-display text-page text-ink">
            {brand.name}
          </h2>
          <Badge tone={status.tone}>{status.label}</Badge>
          {sub.renewalOf && <Badge tone="accent">تجديد</Badge>}
        </div>
        <p className="mt-1.5 text-ui text-ink-2">
          باقة {sub.planSnapshot.nameAr}، اشتراك {BILLING_LABEL[sub.billingPeriod]}
          {payment.reviewedAt && !pending ? (
            <> — {payment.status === "APPROVED" ? "اعتُمد" : "رُفض"} في {formatDateTime(payment.reviewedAt)}</>
          ) : (
            payment.submittedAt && <> — أُرسل للمراجعة {formatRelative(payment.submittedAt)}</>
          )}
        </p>
      </header>

      <div className="grid flex-1 gap-8 px-5 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        {/* Facts first in reading order (right side in RTL); the receipt to compare against sits beside it. */}
        <section aria-label="بيانات التحويل المطلوب مطابقتها" className="min-w-0">
          <h3 className="mb-1 text-ui font-semibold text-ink">قارن مع الإيصال</h3>
          <dl>
            <Row label="المبلغ المطلوب" strong>
              <span className="num">{formatMoney(payment.amount)}</span>
            </Row>
            <Row label="الرقم المرجعي">
              <span className="num truncate rounded-sm bg-sunken px-2 py-0.5 tracking-wider">
                {payment.transactionReference ?? "—"}
              </span>
              {payment.transactionReference && <CopyValue value={payment.transactionReference} label="الرقم المرجعي" />}
            </Row>
            <Row label="اسم المحوِّل">{payment.senderName || <span className="text-ink-3">لم يُذكر</span>}</Row>
            <Row label="وقت التحويل">
              {payment.paidAt ? formatDateTime(payment.paidAt) : <span className="text-ink-3">لم يُذكر</span>}
            </Row>
          </dl>

          <h3 className="mb-1 mt-8 text-ui font-semibold text-ink">البراند</h3>
          <dl>
            <Row label="حالة البراند">
              <Badge tone={brandStatus.tone}>{brandStatus.label}</Badge>
            </Row>
            <Row label="هاتف التواصل">
              <span className="num">{formatPhone(brand.contact?.phone)}</span>
            </Row>
            <Row label="مدفوع حتى">
              {brand.subscriptionEndsAt ? formatDate(brand.subscriptionEndsAt) : <span className="text-ink-3">لا يوجد اشتراك سابق</span>}
            </Row>
          </dl>

          {payment.previousAttempts.length > 0 && (
            <>
              <h3 className="mb-2 mt-8 text-ui font-semibold text-ink">
                محاولات سابقة مرفوضة <span className="num text-ink-3">({payment.previousAttempts.length})</span>
              </h3>
              <ol className="flex flex-col gap-2">
                {payment.previousAttempts.map((a, i) => (
                  <li key={i} className="rounded-sm border-s-2 border-danger/50 bg-sunken px-3 py-2 text-ui">
                    <p className="text-ink">{a.rejectionReason ?? "بدون سبب مسجّل"}</p>
                    <p className="mt-0.5 text-meta text-ink-3">
                      المرجع <span className="num">{a.transactionReference}</span>، {formatDateTime(a.submittedAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}

          {pending && brand.status !== "ACTIVE" && (
            <div className="mt-8 rounded-sm border border-warning/30 bg-warning-soft px-4 py-3 text-ui">
              <p className="font-semibold text-warning">
                {brand.status === "PENDING_REVIEW" ? "بيانات البراند لم تُراجع بعد" : "البراند غير مفعّل"}
              </p>
              <p className="mt-1 text-ink">
                {brand.status === "PENDING_REVIEW"
                  ? "لو اعتمدت الدفع سيبدأ الاشتراك، لكن المتجر لن يظهر للعملاء حتى توافق على بيانات البراند."
                  : "لو اعتمدت الدفع سيبدأ الاشتراك، لكن المتجر سيبقى مخفيًا ما دام البراند موقوفًا أو مرفوضًا."}
              </p>
            </div>
          )}

          {payment.status === "REJECTED" && payment.rejectionReason && (
            <div className="mt-8 rounded-sm border border-danger/30 bg-danger-soft px-4 py-3 text-ui">
              <p className="font-semibold text-danger">سبب الرفض</p>
              <p className="mt-1 text-ink">{payment.rejectionReason}</p>
              <p className="mt-1 text-meta text-ink-2">{formatDateTime(payment.reviewedAt)} — بانتظار إيصال جديد من صاحب البراند.</p>
            </div>
          )}
          {payment.status === "APPROVED" && payment.reviewNote && (
            <div className="mt-8 rounded-sm border border-line bg-sunken px-4 py-3 text-ui">
              <p className="font-semibold text-ink">ملاحظة المراجعة</p>
              <p className="mt-1 text-ink-2">{payment.reviewNote}</p>
            </div>
          )}
        </section>

        <ReceiptViewer
          paymentId={payment._id}
          hasProof={!!payment.proofFileId}
          approvedAt={approvedAt ?? undefined}
          stampAnimating={!!stampAt}
        />
      </div>

      {pending && (
        <footer className="sticky bottom-0 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur sm:px-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <fieldset className="min-w-0" disabled={!!stampAt}>
              <legend className="mb-1 text-meta font-medium text-ink-3">قبل الاعتماد، تأكد بنفسك:</legend>
              <Checkbox checked={amountChecked} onCheckedChange={setAmountChecked}>
                وصل مبلغ <span className="num font-semibold">{formatMoney(payment.amount)}</span> فعلًا إلى حساب InstaPay
              </Checkbox>
              <Checkbox checked={referenceChecked} onCheckedChange={setReferenceChecked}>
                الرقم المرجعي في تطبيق InstaPay مطابق للمكتوب هنا
              </Checkbox>
              {amountChecked && referenceChecked && (
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="ملاحظة داخلية اختيارية، مثل: تمت المطابقة مع كشف الحساب"
                  aria-label="ملاحظة داخلية"
                  className="mt-2 min-h-16 text-ui"
                />
              )}
            </fieldset>
            <div className="flex shrink-0 gap-2">
              <Button variant="danger" onClick={() => setRejecting(true)} disabled={!!stampAt || approve.isPending}>
                رفض
                <Kbd>R</Kbd>
              </Button>
              <Button
                variant="primary"
                onClick={() => approve.mutate()}
                disabled={!canApprove}
                loading={approve.isPending}
                className="min-w-44"
              >
                اعتماد الدفع وتفعيل الاشتراك
                <Kbd>A</Kbd>
              </Button>
            </div>
          </div>
        </footer>
      )}

      {payment.status === "AWAITING_PROOF" && (
        <footer className="flex items-center gap-2 border-t border-line px-5 py-4 text-ui text-ink-2 sm:px-8">
          <RotateCcw aria-hidden className="size-4" />
          تم إنشاء طلب الاشتراك، وننتظر أن يرفع صاحب البراند إيصال التحويل.
        </footer>
      )}

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        onConfirm={(reason) => reject.mutate(reason)}
        loading={reject.isPending}
        brandName={brand.name}
      />
    </article>
  );
}

function ReviewSkeleton() {
  return (
    <div className="px-5 py-6 sm:px-8" aria-busy aria-label="جارٍ تحميل الإيصال">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <Skeleton className="aspect-[3/4] w-full" />
      </div>
    </div>
  );
}
