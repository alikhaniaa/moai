"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { faNum, toman } from "@/lib/format";

export type SnappPayPanelItem = {
  id: string;
  nameFa: string;
  sizeLabel: string | null;
  colorName: string | null;
  unitPrice: number;
  qty: number;
};

/**
 * مرجوعی و تغییر سفارش اسنپ‌پی - the admin side of the two follow-up services.
 *
 * اسنپ‌پی's certification review asks for exactly this on the merchant's own
 * panel: cut a basket down (تغییر سبد) or take the whole purchase back
 * (لغو کامل), and - because neither can be undone once it has left - ask for a
 * confirmation first. Hence the modal: nothing reaches اسنپ‌پی until the admin
 * has read what is about to happen and said yes to it.
 *
 * The arithmetic here only *previews* the new total; the binding one is
 * computed again on the server by `repriceOrder`. The two must stay in step - 
 * same rules: shipping is left exactly as it was, and the coupon is pro-rated to
 * the goods that remain, so the total can only fall (اسنپ‌پی
 * refuses an update that raises it, error 1042).
 */
export default function SnappPayOrderPanel({
  orderId,
  items,
  discount,
  shippingCost,
  total,
  blockedReason,
  customerRequest,
  onUpdate,
  onCancel,
  onRejectRequest,
}: {
  orderId: string;
  items: SnappPayPanelItem[];
  discount: number;
  shippingCost: number;
  total: number;
  /** Persian reason the panel cannot be used, or null when it can. */
  blockedReason: string | null;
  customerRequest: {
    id: string;
    kind: "UPDATE" | "CANCEL";
    summary: string | null;
    createdAtLabel: string;
    requestedQty: Record<string, number>;
  } | null;
  onUpdate: (formData: FormData) => void;
  onCancel: (formData: FormData) => void;
  onRejectRequest: (formData: FormData) => void;
}) {
  const usable = blockedReason === null;
  const updateAllowed = usable && (!customerRequest || customerRequest.kind === "UPDATE");
  const cancelAllowed = usable && (!customerRequest || customerRequest.kind === "CANCEL");

  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        customerRequest?.kind === "UPDATE"
          ? Math.max(0, Math.min(i.qty, customerRequest.requestedQty[i.id] ?? i.qty))
          : i.qty,
      ])
    )
  );
  const [confirming, setConfirming] = useState<"update" | "cancel" | "reject" | null>(null);
  const [sent, setSent] = useState(false);

  const updateForm = useRef<HTMLFormElement>(null);
  const cancelForm = useRef<HTMLFormElement>(null);
  const rejectForm = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Never above what the line still has, whatever is sitting in state. */
  const at = (i: SnappPayPanelItem) => Math.min(qty[i.id] ?? i.qty, i.qty);
  const set = (i: SnappPayPanelItem, next: number) =>
    setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.min(i.qty, next)) }));

  const goodsTotal = items.reduce((s, i) => s + i.unitPrice * at(i), 0);
  // Must match `repriceOrder` on the server exactly, or the admin confirms one
  // number in the popup and a different one is sent to اسنپ‌پی: the coupon is
  // pro-rated to the share of goods kept, then clamped to them.
  const originalGoods = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const newDiscount =
    originalGoods > 0 && discount > 0
      ? Math.min(goodsTotal, Math.round((discount * goodsTotal) / originalGoods))
      : 0;
  const newTotal = goodsTotal - newDiscount + shippingCost;
  const refund = total - newTotal;

  const changed = items.filter((i) => at(i) !== i.qty);
  // Zeroing every line is a full return, and اسنپ‌پی wants that as a لغو rather
  // than as an update with an empty cart - the server refuses it («emptycart»).
  const emptied = items.length > 0 && items.every((i) => at(i) === 0);

  /** A request already on its way to اسنپ‌پی must not be waved away as if nothing had happened. */
  const close = useCallback(() => {
    if (!sent) setConfirming(null);
  }, [sent]);

  // Escape closes the confirmation, and the page behind it stays put while it is up.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [confirming, close]);

  // Focus moves onto the card itself so Escape and screen readers reach it.
  useEffect(() => {
    if (confirming) panelRef.current?.focus();
  }, [confirming]);

  /** The only path to اسنپ‌پی: the modal's own button, never the form's. */
  const send = () => {
    setSent(true);
    if (confirming === "cancel") cancelForm.current?.requestSubmit();
    else if (confirming === "reject") rejectForm.current?.requestSubmit();
    else updateForm.current?.requestSubmit();
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-sand-200 bg-[#007DFA]/6 px-6 py-4">
          <h2 className="font-bold text-[#0062c4]">مرجوعی و تغییر سفارش اسنپ‌پی</h2>
          <p className="text-xs text-ink/60">
            تعداد هر قلم فقط می‌تواند کم شود؛ مابه‌التفاوت به اعتبار اسنپ‌پی مشتری برمی‌گردد.
          </p>
        </div>

        <div className="p-6">
          {blockedReason && (
            <p className="mb-5 rounded-2xl bg-gold/15 px-5 py-4 text-sm leading-7 text-clay-700">
              {blockedReason}
            </p>
          )}

          {customerRequest && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#007DFA]/25 bg-[#007DFA]/5">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-52 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-sm text-[#0062c4]">درخواست جدید مشتری</b>
                    <span className="chip bg-white text-[#0062c4]">
                      {customerRequest.kind === "CANCEL" ? "لغو کامل" : "تغییر سفارش"}
                    </span>
                    <span className="text-xs text-ink/50">{customerRequest.createdAtLabel}</span>
                  </div>
                  {customerRequest.summary && (
                    <p className="mt-2 text-sm leading-7 text-ink/75">{customerRequest.summary}</p>
                  )}
                  <p className="mt-1 text-xs leading-6 text-ink/55">
                    مقادیر درخواست در پایین آماده شده‌اند. اجرای نهایی فقط پس از تأیید شما انجام می‌شود.
                  </p>
                </div>
                <form ref={rejectForm} action={onRejectRequest}>
                  <input type="hidden" name="id" value={orderId} />
                  <input type="hidden" name="requestId" value={customerRequest.id} />
                  <button
                    type="button"
                    onClick={() => setConfirming("reject")}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    رد درخواست
                  </button>
                </form>
              </div>
            </div>
          )}

          <form action={onUpdate} ref={updateForm}>
            <input type="hidden" name="id" value={orderId} />
            {customerRequest?.kind === "UPDATE" && (
              <input type="hidden" name="requestId" value={customerRequest.id} />
            )}

            <ul className="divide-y divide-sand-100">
              {items.map((i) => {
                const q = at(i);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
                    {/* every line posts a field, changed or not */}
                    <input type="hidden" name={`qty:${i.id}`} value={q} />

                    <div className="min-w-40 flex-1 text-sm">
                      <span className="text-ink/82">
                        {i.nameFa}
                        {i.sizeLabel && (
                          <b className="mr-2 rounded-full bg-sea-100 px-2 py-0.5 text-xs text-sea-700">
                            سایز {i.sizeLabel}
                          </b>
                        )}
                        {i.colorName && (
                          <b className="mr-2 rounded-full bg-clay-500/12 px-2 py-0.5 text-xs text-clay-700">
                            رنگ {i.colorName}
                          </b>
                        )}
                      </span>
                      <div className="mt-1 text-xs text-ink/55">
                        واحدی {toman(i.unitPrice)} · خرید اولیه {faNum(i.qty)} عدد
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => set(i, q - 1)}
                        disabled={!updateAllowed || !!customerRequest || q === 0}
                        aria-label={`کم‌کردن ${i.nameFa}`}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-sand-100 text-lg font-bold text-sea-900 transition-colors hover:bg-sand-200 disabled:opacity-35 disabled:hover:bg-sand-100"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-sea-900">
                        {faNum(q)}
                      </span>
                      <button
                        type="button"
                        onClick={() => set(i, q + 1)}
                        disabled={!updateAllowed || !!customerRequest || q === i.qty}
                        aria-label={`زیادکردن ${i.nameFa}`}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-sand-100 text-lg font-bold text-sea-900 transition-colors hover:bg-sand-200 disabled:opacity-35 disabled:hover:bg-sand-100"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-28 shrink-0 text-left text-sm font-semibold text-sea-900">
                      {q === i.qty ? (
                        toman(i.unitPrice * q)
                      ) : (
                        <>
                          <span className="block text-xs font-normal text-ink/45 line-through">
                            {toman(i.unitPrice * i.qty)}
                          </span>
                          {q === 0 ? (
                            <span className="text-red-600">حذف می‌شود</span>
                          ) : (
                            toman(i.unitPrice * q)
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 space-y-1 border-t border-sand-200 pt-4 text-sm">
              <Line label="جمع کالاها" value={toman(goodsTotal)} />
              {discount > 0 && <Line label="تخفیف" value={`− ${toman(newDiscount)}`} />}
              <Line
                label="ارسال (دست‌نخورده می‌ماند)"
                value={shippingCost ? toman(shippingCost) : "پس‌کرایه"}
              />
              <div className="flex justify-between pt-2 text-base">
                <span className="font-bold text-sea-900">جمع کل جدید</span>
                <span className="price-lg text-sea-900">{toman(newTotal)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-[#0062c4]">بازگشت به اعتبار مشتری</span>
                <span className="font-bold text-[#0062c4]">{toman(refund)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirming("update")}
              disabled={!updateAllowed || changed.length === 0 || emptied}
              className="btn btn-primary mt-6 w-full disabled:opacity-45 disabled:shadow-none"
            >
              {customerRequest?.kind === "UPDATE" ? "تأیید و اجرای درخواست مشتری" : "اعمال تغییر"}
            </button>

            {emptied && (
              <p className="mt-2 text-center text-xs leading-6 text-clay-600">
                همه‌ی اقلام صفر شده‌اند — برای مرجوع‌کردن کل سفارش از «لغو کامل» پایین استفاده کن.
              </p>
            )}
            {usable && changed.length === 0 && (
              <p className="mt-2 text-center text-xs leading-6 text-ink/55">
                تا وقتی تعداد چیزی را کم نکرده‌ای، موردی برای فرستادن نیست.
              </p>
            )}
          </form>

          <form
            action={onCancel}
            ref={cancelForm}
            className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-red-200 bg-red-50/60 p-5"
          >
            <input type="hidden" name="id" value={orderId} />
            {customerRequest?.kind === "CANCEL" && (
              <input type="hidden" name="requestId" value={customerRequest.id} />
            )}
            <p className="min-w-52 flex-1 text-xs leading-6 text-ink/68">
              کل سفارش لغو می‌شود، <b className="text-red-700">{toman(total)}</b> به اعتبار اسنپ‌پی
              مشتری برمی‌گردد و کالاها به موجودی انبار بازمی‌گردند.
            </p>
            <button
              type="button"
              onClick={() => setConfirming("cancel")}
              disabled={!cancelAllowed}
              className="btn shrink-0 bg-red-600 text-sand-50 hover:bg-red-700 disabled:opacity-45"
            >
              {customerRequest?.kind === "CANCEL"
                ? "تأیید لغو درخواستی مشتری"
                : "لغو کامل سفارش و بازگشت وجه"}
            </button>
          </form>
        </div>
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-[240] flex items-end justify-center p-0 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapp-confirm-title"
        >
          <div className="absolute inset-0 bg-sea-900/55 backdrop-blur-sm" onClick={close} />

          <div
            ref={panelRef}
            tabIndex={-1}
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-sand-200 bg-sand-50 shadow-2xl outline-none sm:rounded-3xl"
          >
            <div className={`px-6 py-5 ${confirming === "update" ? "bg-[#007DFA]" : "bg-red-600"}`}>
              <p id="snapp-confirm-title" className="font-display text-2xl font-bold text-white">
                {confirming === "cancel"
                  ? "لغو کامل سفارش؟"
                  : confirming === "reject"
                    ? "رد درخواست مشتری؟"
                    : "ارسال تغییر سبد به اسنپ‌پی؟"}
              </p>
              <p className="text-xs text-white/85">
                {confirming === "cancel"
                  ? "کل مبلغ به اعتبار مشتری برمی‌گردد"
                  : confirming === "reject"
                    ? "هیچ درخواستی به اسنپ‌پی فرستاده نمی‌شود"
                  : "مابه‌التفاوت به اعتبار مشتری برمی‌گردد"}
              </p>
            </div>

            <div className="px-6 py-6">
              {confirming === "reject" ? (
                <p className="text-sm leading-8 text-ink/82">
                  درخواست مشتری رد و از صف بررسی خارج می‌شود. سفارش و پرداخت اسنپ‌پی هیچ تغییری
                  نمی‌کنند و مشتری نتیجه را در حساب خود می‌بیند.
                </p>
              ) : confirming === "cancel" ? (
                <>
                  <p className="text-sm leading-8 text-ink/82">
                    این سفارش به‌طور کامل لغو می‌شود و{" "}
                    <b className="text-sea-900">{toman(total)}</b> — تمام مبلغ آن — به اعتبار
                    اسنپ‌پی مشتری برگردانده می‌شود.
                  </p>
                  <p className="mt-3 text-sm leading-8 text-ink/75">
                    وضعیت سفارش «لغو شده» می‌شود، کالاها به موجودی انبار برمی‌گردند و امتیاز باشگاهی
                    که بابت این خرید داده شده پس گرفته می‌شود.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-sea-900">این اقلام تغییر می‌کنند:</p>
                  <ul className="mt-2 space-y-1.5 rounded-2xl bg-sand-100 px-4 py-3 text-sm leading-7 text-ink/82">
                    {changed.map((i) => (
                      <li key={i.id}>
                        {at(i) === 0 ? (
                          <>
                            حذف کامل <b className="text-sea-900">{i.nameFa}</b>
                            {i.sizeLabel ? ` (سایز ${i.sizeLabel})` : ""}
                            {i.colorName ? ` (رنگ ${i.colorName})` : ""}
                          </>
                        ) : (
                          <>
                            <b className="text-sea-900">{i.nameFa}</b>
                            {i.sizeLabel ? ` (سایز ${i.sizeLabel})` : ""}
                            {i.colorName ? ` (رنگ ${i.colorName})` : ""} — از {faNum(i.qty)} عدد به{" "}
                            {faNum(at(i))} عدد
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm leading-8 text-ink/82">
                    مبلغ سفارش از <b className="text-sea-900">{toman(total)}</b> به{" "}
                    <b className="text-sea-900">{toman(newTotal)}</b> کاهش پیدا می‌کند و{" "}
                    <b className="text-[#0062c4]">{toman(refund)}</b> به اعتبار اسنپ‌پی مشتری
                    برمی‌گردد.
                  </p>
                </>
              )}

              {confirming !== "reject" && (
                <p className="mt-5 rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
                  این درخواست همین حالا به اسنپ‌پی فرستاده می‌شود و <b>برگشت‌پذیر نیست</b> — هیچ
                  سرویسی آن را پس نمی‌گیرد. اگر مطمئن نیستی، «انصراف» بزن.
                </p>
              )}

              <button
                type="button"
                onClick={send}
                disabled={sent}
                className={
                  confirming !== "update"
                    ? "btn mt-6 w-full bg-red-600 text-sand-50 hover:bg-red-700 disabled:opacity-60"
                    : "btn btn-primary mt-6 w-full disabled:opacity-60"
                }
              >
                {sent
                  ? "در حال ثبت…"
                  : confirming === "reject"
                    ? "بله، درخواست رد شود"
                    : "بله، ارسال به اسنپ‌پی"}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={sent}
                className="btn btn-ghost mt-2 w-full disabled:opacity-45"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-ink/60">{label}</span>
      <span className="font-semibold text-sea-900">{value}</span>
    </div>
  );
}
