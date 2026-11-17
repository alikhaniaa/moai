"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { faNum, toman } from "@/lib/format";

type Item = {
  id: string;
  nameFa: string;
  sizeLabel: string | null;
  colorName: string | null;
  unitPrice: number;
  qty: number;
};

type PendingRequest = {
  id: string;
  kind: string;
  summary: string | null;
  createdAtLabel: string;
} | null;

type LastRequest = {
  status: string;
  kind: string;
  resolution: string | null;
} | null;

type Action = (formData: FormData) => void | Promise<void>;

export default function SnappPayRequestPanel({
  orderId,
  items,
  discount,
  shippingCost,
  total,
  pendingRequest,
  lastRequest,
  onRequestUpdate,
  onRequestCancel,
  onWithdraw,
}: {
  orderId: string;
  items: Item[];
  discount: number;
  shippingCost: number;
  total: number;
  pendingRequest: PendingRequest;
  lastRequest: LastRequest;
  onRequestUpdate: Action;
  onRequestCancel: Action;
  onWithdraw: Action;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.qty]))
  );
  const [confirming, setConfirming] = useState<"update" | "cancel" | "withdraw" | null>(null);
  const [sent, setSent] = useState(false);
  const updateForm = useRef<HTMLFormElement>(null);
  const cancelForm = useRef<HTMLFormElement>(null);
  const withdrawForm = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const at = (item: Item) => Math.max(0, Math.min(item.qty, qty[item.id] ?? item.qty));
  const set = (item: Item, next: number) =>
    setQty((current) => ({ ...current, [item.id]: Math.max(0, Math.min(item.qty, next)) }));

  const originalGoods = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const goodsTotal = items.reduce((sum, item) => sum + item.unitPrice * at(item), 0);
  const newDiscount =
    originalGoods > 0 && discount > 0
      ? Math.min(goodsTotal, Math.round((discount * goodsTotal) / originalGoods))
      : 0;
  const newTotal = goodsTotal - newDiscount + shippingCost;
  const refund = Math.max(0, total - newTotal);
  const changed = items.filter((item) => at(item) !== item.qty);
  const emptied = items.length > 0 && items.every((item) => at(item) === 0);

  const closeDialog = useCallback(() => {
    if (!sent) setConfirming(null);
  }, [sent]);

  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [confirming, closeDialog]);

  useEffect(() => {
    if (confirming) dialogRef.current?.focus();
  }, [confirming]);

  const submit = () => {
    setSent(true);
    if (confirming === "cancel") cancelForm.current?.requestSubmit();
    else if (confirming === "withdraw") withdrawForm.current?.requestSubmit();
    else updateForm.current?.requestSubmit();
  };

  if (pendingRequest) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#007DFA]/25 bg-[#007DFA]/5">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007DFA] text-sm text-white">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-sm text-[#0062c4]">درخواست شما در انتظار بررسی است</b>
              <span className="chip bg-white text-[#0062c4]">
                {pendingRequest.kind === "CANCEL" ? "لغو کامل" : "تغییر سفارش"}
              </span>
            </div>
            {pendingRequest.summary && (
              <p className="mt-1.5 text-xs leading-6 text-ink/68">{pendingRequest.summary}</p>
            )}
            <p className="mt-1 text-[11px] text-ink/50">ثبت‌شده در {pendingRequest.createdAtLabel}</p>
          </div>
        </div>
        <div className="border-t border-[#007DFA]/15 bg-white/50 px-4 py-3">
          <button
            type="button"
            onClick={() => setConfirming("withdraw")}
            className="text-xs font-bold text-red-600 underline decoration-red-200 underline-offset-4"
          >
            پس‌گرفتن درخواست
          </button>
        </div>

        <form ref={withdrawForm} action={onWithdraw}>
          <input type="hidden" name="requestId" value={pendingRequest.id} />
        </form>

        {confirming === "withdraw" && (
          <ConfirmDialog
            dialogRef={dialogRef}
            title="درخواست را پس می‌گیرید؟"
            tone="red"
            sent={sent}
            onClose={closeDialog}
            onSubmit={submit}
            submitLabel="بله، درخواست را پس بگیر"
          >
            <p className="text-sm leading-8 text-ink/82">
              این درخواست از صف بررسی فروشگاه خارج می‌شود. تا وقتی فروشگاه آن را تأیید نکرده، هیچ
              تغییری در سفارش یا اعتبار اسنپ‌پی شما ایجاد نشده است.
            </p>
          </ConfirmDialog>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-4 space-y-3">
        {lastRequest && lastRequest.status !== "WITHDRAWN" && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs leading-6 ${
              lastRequest.status === "COMPLETED"
                ? "bg-sea-100 text-sea-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <b className="block">
              {lastRequest.status === "COMPLETED"
                ? lastRequest.kind === "CANCEL"
                  ? "درخواست لغو انجام شد"
                  : "درخواست تغییر انجام شد"
                : "درخواست شما تأیید نشد"}
            </b>
            {lastRequest.resolution && <span>{lastRequest.resolution}</span>}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-right transition-colors hover:border-[#007DFA]/35 hover:bg-[#007DFA]/5"
        >
          <span>
            <b className="block text-sm text-sea-900">درخواست تغییر یا لغو سفارش</b>
            <span className="mt-0.5 block text-[11px] text-ink/55">برای خرید پرداخت‌شده با اسنپ‌پی</span>
          </span>
          <span className="text-xl text-[#007DFA]" aria-hidden>←</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#007DFA]/25 bg-white">
        <div className="flex items-start justify-between gap-3 bg-[#007DFA]/6 px-4 py-4">
          <div>
            <b className="text-sm text-[#0062c4]">درخواست تغییر سفارش</b>
            <p className="mt-1 text-[11px] leading-5 text-ink/55">
              تعداد کالا را کم کنید. پس از بررسی فروشگاه، مبلغ مربوط به اعتبار اسنپ‌پی برمی‌گردد.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="بستن"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lg text-ink/60 shadow-sm"
          >
            ×
          </button>
        </div>

        <form ref={updateForm} action={onRequestUpdate} className="px-4 py-2">
          <input type="hidden" name="id" value={orderId} />
          <ul className="divide-y divide-sand-100">
            {items.map((item) => {
              const current = at(item);
              return (
                <li key={item.id} className="py-3">
                  <input type="hidden" name={`qty:${item.id}`} value={current} />
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-sea-900">
                        {item.nameFa}
                        {item.sizeLabel ? ` · سایز ${item.sizeLabel}` : ""}
                        {item.colorName ? ` · ${item.colorName}` : ""}
                      </div>
                      <div className="mt-1 text-[11px] text-ink/50">واحدی {toman(item.unitPrice)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-xl bg-sand-100 p-1">
                      <button
                        type="button"
                        onClick={() => set(item, current - 1)}
                        disabled={current === 0}
                        aria-label={`کم‌کردن ${item.nameFa}`}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-white text-lg font-bold text-sea-900 shadow-sm disabled:opacity-35"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-sea-900">{faNum(current)}</span>
                      <button
                        type="button"
                        onClick={() => set(item, current + 1)}
                        disabled={current === item.qty}
                        aria-label={`زیادکردن ${item.nameFa}`}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-white text-lg font-bold text-sea-900 shadow-sm disabled:opacity-35"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="my-3 rounded-xl bg-sand-100 px-3 py-3 text-xs">
            <PreviewLine label="جمع جدید" value={toman(newTotal)} strong />
            <PreviewLine label="بازگشت تقریبی به اعتبار" value={toman(refund)} blue />
            <p className="mt-1.5 text-[10px] leading-5 text-ink/50">
              هزینه ارسال تغییر نمی‌کند و تخفیف متناسب با کالاهای باقی‌مانده محاسبه می‌شود.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirming("update")}
            disabled={changed.length === 0 || emptied}
            className="btn btn-primary w-full !py-2.5 text-xs disabled:opacity-40 disabled:shadow-none"
          >
            ثبت درخواست تغییر
          </button>
          {emptied && (
            <p className="mt-2 text-center text-[11px] leading-5 text-red-600">
              برای حذف همه‌ی کالاها از گزینه «لغو کامل» استفاده کنید.
            </p>
          )}
        </form>

        <form ref={cancelForm} action={onRequestCancel} className="m-4 border-t border-sand-200 pt-4">
          <input type="hidden" name="id" value={orderId} />
          <button
            type="button"
            onClick={() => setConfirming("cancel")}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
          >
            درخواست لغو کامل سفارش
          </button>
        </form>
      </div>

      {(confirming === "update" || confirming === "cancel") && (
        <ConfirmDialog
          dialogRef={dialogRef}
          title={confirming === "cancel" ? "درخواست لغو کامل؟" : "درخواست تغییر ثبت شود؟"}
          tone={confirming === "cancel" ? "red" : "blue"}
          sent={sent}
          onClose={closeDialog}
          onSubmit={submit}
          submitLabel={confirming === "cancel" ? "بله، درخواست لغو را ثبت کن" : "بله، درخواست را ثبت کن"}
        >
          {confirming === "cancel" ? (
            <p className="text-sm leading-8 text-ink/82">
              درخواست لغو کامل این سفارش و بازگشت <b>{toman(total)}</b> ثبت می‌شود.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-sea-900">تغییر درخواستی شما:</p>
              <ul className="mt-2 space-y-1 rounded-2xl bg-sand-100 px-4 py-3 text-sm leading-7 text-ink/75">
                {changed.map((item) => (
                  <li key={item.id}>
                    {item.nameFa}: {faNum(item.qty)} ← {faNum(at(item))}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-8 text-ink/82">
                مبلغ بازگشتی تقریبی <b className="text-[#0062c4]">{toman(refund)}</b> است.
              </p>
            </>
          )}
          <p className="mt-4 rounded-2xl bg-[#007DFA]/7 px-4 py-3 text-xs leading-6 text-[#0055a8]">
            این مرحله فقط درخواست شما را برای فروشگاه ثبت می‌کند. پس از بررسی و تأیید فروشگاه، تغییر
            در اسنپ‌پی اجرا می‌شود.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

function ConfirmDialog({
  dialogRef,
  title,
  tone,
  sent,
  onClose,
  onSubmit,
  submitLabel,
  children,
}: {
  dialogRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  tone: "blue" | "red";
  sent: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-sea-900/55 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-sand-50 shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className={`px-6 py-5 ${tone === "red" ? "bg-red-600" : "bg-[#007DFA]"}`}>
          <h3 className="font-display text-2xl font-bold text-white">{title}</h3>
        </div>
        <div className="px-6 py-6">
          {children}
          <button
            type="button"
            onClick={onSubmit}
            disabled={sent}
            className={`btn mt-6 w-full text-white disabled:opacity-60 ${tone === "red" ? "bg-red-600 hover:bg-red-700" : "bg-[#007DFA] hover:bg-[#0062c4]"}`}
          >
            {sent ? "در حال ثبت…" : submitLabel}
          </button>
          <button type="button" onClick={onClose} disabled={sent} className="btn btn-ghost mt-2 w-full disabled:opacity-45">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewLine({ label, value, strong, blue }: { label: string; value: string; strong?: boolean; blue?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={strong ? "font-bold text-sea-900" : "text-ink/60"}>{label}</span>
      <span className={`font-bold ${blue ? "text-[#0062c4]" : "text-sea-900"}`}>{value}</span>
    </div>
  );
}
