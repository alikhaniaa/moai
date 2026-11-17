import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  toman, faNum, faDate, faTime, orderCode,
  ORDER_STATUS_FA, ORDER_STATUS_COLOR,
} from "@/lib/format";
import {
  setTracking, approveManualOrder, snapppayUpdateOrder, snapppayCancelOrder,
  rejectSnapppayChangeRequest,
} from "../../actions";
import SnappPayPlan, { SnappPayMark } from "@/components/SnappPayPlan";
import SnappPayOrderPanel from "@/components/admin/SnappPayOrderPanel";
import { snapppayStagingBase } from "@/lib/snapppay-api";

export const dynamic = "force-dynamic";

/** What came back from تغییر سبد / لغو کامل, as `?snapp=` on the redirect. */
const SNAPP_BANNER: Record<string, { tone: "ok" | "bad" | "warn"; text: string }> = {
  notfound: {
    tone: "bad",
    text: "سفارشی با این شناسه پیدا نشد؛ هیچ درخواستی به اسنپ‌پی فرستاده نشد.",
  },
  notsnapppay: {
    tone: "bad",
    text: "این سفارش از درگاه اسنپ‌پی پرداخت نشده، پس مرجوعی و لغو اسنپ‌پی روی آن معنا ندارد.",
  },
  nopayment: {
    tone: "bad",
    text: "برای این سفارش تراکنش موفق اسنپ‌پی ثبت نشده؛ چیزی برای مرجوع‌کردن نیست.",
  },
  unsettled: {
    tone: "warn",
    text: "تا وقتی تسویه اسنپ‌پی انجام نشده، تغییر سبد و لغو پذیرفته نمی‌شود. اول تسویه را انجام بده.",
  },
  nochange: {
    tone: "warn",
    text: "هیچ تعدادی تغییر نکرده بود؛ چیزی به اسنپ‌پی فرستاده نشد.",
  },
  emptycart: {
    tone: "warn",
    text: "همه‌ی اقلام صفر شده بودند. برای مرجوع‌کردن کل سفارش باید «لغو کامل» را بزنی، نه تغییر سبد.",
  },
  higher: {
    tone: "warn",
    text: "مبلغ جدید از مبلغ اولیه بیشتر می‌شد و اسنپ‌پی چنین تغییری را نمی‌پذیرد؛ چیزی فرستاده نشد.",
  },
  updateunknown: {
    tone: "warn",
    text:
      "اسنپ‌پی در مهلت مقرر پاسخ نداد، پس معلوم نیست تغییر اعمال شده یا نه. سفارش دست‌نخورده ماند. " +
      "پیش از تلاش دوباره، وضعیت را با پشتیبانی اسنپ‌پی بررسی کن — تکرار درخواست می‌تواند دو بار مرجوع کند.",
  },
  cancelunknown: {
    tone: "warn",
    text:
      "اسنپ‌پی در مهلت مقرر پاسخ نداد و استعلام وضعیت هم لغو را تأیید نکرد. سفارش دست‌نخورده ماند؛ " +
      "پیش از تلاش دوباره وضعیت را بررسی کن.",
  },
  updatefailed: {
    tone: "bad",
    text: "اسنپ‌پی تغییر سبد را نپذیرفت و سفارش دست‌نخورده ماند. دلیلش در تاریخچه‌ی پایین همین صفحه ثبت شده است.",
  },
  updated: {
    tone: "ok",
    text: "✓ سبد سفارش تغییر کرد و مابه‌التفاوت به اعتبار اسنپ‌پی مشتری برگشت.",
  },
  cancelfailed: {
    tone: "bad",
    text: "اسنپ‌پی لغو را نپذیرفت و سفارش دست‌نخورده ماند. دلیلش در تاریخچه‌ی پایین همین صفحه ثبت شده است.",
  },
  cancelled: {
    tone: "ok",
    text: "✓ سفارش لغو شد و کل مبلغ به اعتبار اسنپ‌پی مشتری برگشت.",
  },
  requestinvalid: {
    tone: "warn",
    text: "این درخواست مشتری دیگر باز یا معتبر نیست؛ هیچ عملیاتی در اسنپ‌پی انجام نشد.",
  },
  requestrejected: {
    tone: "ok",
    text: "درخواست مشتری رد شد و سفارش و پرداخت اسنپ‌پی تغییری نکردند.",
  },
};

const SNAPP_TONE: Record<string, string> = {
  ok: "bg-sea-100 text-sea-700",
  bad: "bg-red-50 text-red-700",
  warn: "bg-gold/15 text-clay-700",
};

const OPERATION_FA: Record<string, string> = {
  UPDATE: "تغییر سبد",
  CANCEL: "لغو کامل",
  SETTLE: "تسویه",
  REVERT: "برگشت",
};

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ snapp?: string }>;
}) {
  const { id } = await params;
  const { snapp } = (await searchParams) ?? {};
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      user: true,
      payments: {
        orderBy: { createdAt: "desc" },
        include: { operations: { orderBy: { createdAt: "desc" } } },
      },
      snappPayChangeRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  const banner = snapp ? SNAPP_BANNER[snapp] : undefined;

  const paid = order.payments.find((p) => p.status === "PAID");
  const snapppay = order.paymentMethod === "SNAPPPAY";
  const snapppayIpg = order.paymentMethod === "SNAPPPAY_IPG";
  const cardTransfer = order.paymentMethod === "CARD";
  const awaitingApproval =
    (snapppay && order.status === "AWAITING_SNAPPPAY") ||
    (cardTransfer && order.status === "AWAITING_TRANSFER");

  // The اسنپ‌پی attempt this order is settled on - the one whose transactionId
  // the admin quotes to اسنپ‌پی support, and the one تغییر سبد / لغو act on.
  const snappPayment = snapppayIpg
    ? order.payments.find((p) => p.provider === "SNAPPPAY" && p.status === "PAID" && p.token) ??
      order.payments.find((p) => p.provider === "SNAPPPAY")
    : undefined;
  const pendingCustomerRequest = order.snappPayChangeRequests.find(
    (request) => request.status === "PENDING"
  );
  const requestedQty: Record<string, number> = {};
  if (pendingCustomerRequest?.kind === "UPDATE") {
    try {
      const rows = JSON.parse(pendingCustomerRequest.requestedItems) as Array<{
        id?: unknown;
        qty?: unknown;
      }>;
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (typeof row?.id === "string" && Number.isFinite(Number(row.qty))) {
            requestedQty[row.id] = Math.round(Number(row.qty));
          }
        }
      }
    } catch {
      // The server action performs the binding validation and refuses malformed
      // requests. The panel can still show it so the admin may reject it.
    }
  }

  // Exactly the states `settledSnapppayPayment()` refuses, worked out in
  // advance so the panel explains itself instead of bouncing the admin off a
  // redirect after they have already pressed the button.
  const snappBlocked =
    snappPayment?.status === "PAID" && snappPayment.token && snappPayment.settledAt
      ? null
      : order.status === "CANCELLED"
        ? "این سفارش قبلاً لغو شده و مبلغش به اعتبار مشتری برگشته است؛ تغییر تازه‌ای روی آن ممکن نیست."
        : !snappPayment || snappPayment.status !== "PAID" || !snappPayment.token
          ? "برای این سفارش تراکنش موفق اسنپ‌پی ثبت نشده، پس چیزی برای مرجوع‌کردن نیست."
          : "تا وقتی تسویه اسنپ‌پی انجام نشده، اسنپ‌پی تغییر سبد و لغو را نمی‌پذیرد. اول تسویه را انجام بده، بعد از همین‌جا مرجوعی بزن.";

  const operations = order.payments
    .flatMap((p) => p.operations)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-xs text-clay-600 hover:underline">← همه سفارش‌ها</Link>
          <h1 className="mt-1 font-display text-4xl font-bold text-sea-900">
            سفارش <span dir="ltr">#{orderCode(order.id)}</span>
          </h1>
          <p className="mt-1 text-sm text-ink/60">{faDate(order.createdAt)} — {faTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {snapppay && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#007DFA]/10 py-1 pl-3 pr-1">
              <SnappPayMark size={26} />
              <span className="text-xs font-bold text-[#0062c4]">اقساطی</span>
            </span>
          )}
          {snapppayIpg && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#007DFA]/10 py-1 pl-3 pr-1">
              <SnappPayMark size={26} />
              <span className="text-xs font-bold text-[#0062c4]">اقساطی (درگاه)</span>
            </span>
          )}
          {cardTransfer && (
            <span className="chip bg-gold/20 text-clay-800">🧾 کارت به کارت</span>
          )}
          <span className={`chip text-sm ${ORDER_STATUS_COLOR[order.status] ?? "bg-sand-100"}`}>
            {ORDER_STATUS_FA[order.status] ?? order.status}
          </span>
        </div>
      </div>

      {banner && (
        <p className={`rounded-2xl px-5 py-4 text-sm font-semibold leading-7 ${SNAPP_TONE[banner.tone]}`}>
          {banner.text}
        </p>
      )}

      {snappPayment && (
        <div className="card border-2 border-[#007DFA]/25 bg-[#007DFA]/5 p-6">
          {snapppayStagingBase() && snappPayment.token && (
            <details className="mb-5 rounded-xl bg-white/70 p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-[#0062c4]">توکن سفارش تست برای ارسال به پشتیبانی اسنپ‌پی</summary>
              <p className="mt-2 text-ink/70">این مقدار را همراه ویدئوی همین سفارش برای تیم فنی اسنپ‌پی بفرستید.</p>
              <p dir="ltr" className="mt-3 select-all break-all font-mono">{snappPayment.token}</p>
            </details>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
            <div className="flex items-center gap-3">
              <SnappPayMark size={44} />
              <div>
                <div className="text-xs font-semibold text-[#0062c4]">شناسه تراکنش اسنپ‌پی</div>
                <div
                  dir="ltr"
                  className="mt-1 select-all font-mono text-lg font-bold tracking-wide text-sea-900"
                >
                  {snappPayment.resNum}
                </div>
              </div>
            </div>

            {/* اسنپ‌پی echoes an id of its own; when it differs from ours, both
                are needed to open a support ticket. */}
            {snappPayment.refNum && snappPayment.refNum !== snappPayment.resNum && (
              <div>
                <div className="text-xs font-semibold text-ink/60">شناسه‌ای که اسنپ‌پی برگرداند</div>
                <div dir="ltr" className="mt-1 select-all font-mono text-sm font-bold text-ink/82">
                  {snappPayment.refNum}
                </div>
              </div>
            )}

            <div className="text-xs leading-6 text-ink/68">
              <div>
                مبلغ تراکنش: <b className="text-sea-900">{toman(snappPayment.amountRial / 10)}</b>
              </div>
              <div>
                {snappPayment.status === "REVERSED"
                  ? "لغو شده و مبلغ برگشت داده شده"
                  : snappPayment.settledAt
                    ? `تسویه شد — ${faDate(snappPayment.settledAt)} ${faTime(snappPayment.settledAt)}`
                    : "هنوز تسویه نشده"}
              </div>
            </div>
          </div>
        </div>
      )}

      {awaitingApproval && (
        <div className={`card border-2 p-6 ${snapppay ? "border-[#007DFA]/30" : "border-gold/50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className={`font-bold ${snapppay ? "text-[#0062c4]" : "text-clay-700"}`}>
                {snapppay ? "در انتظار تأیید ثبت‌نام اسنپ‌پی" : "در انتظار تأیید واریز کارت به کارت"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-7 text-ink/75">
                این سفارش ثبت شده و کالاها از موجودی کنار گذاشته شده‌اند، اما هنوز
                نهایی نیست.{" "}
                {snapppay ? (
                  <>
                    <b>فقط زمانی تأیید کن</b> که ثبت‌نام اسنپ‌پی مشتری انجام و قسط
                    اول دریافت شده باشد. با تأیید، سفارش «پرداخت شده» می‌شود، امتیاز
                    باشگاه به مشتری تعلق می‌گیرد و زمان‌بندی اقساط از همین لحظه شروع
                    می‌شود.
                  </>
                ) : (
                  <>
                    <b>فقط زمانی تأیید کن</b> که واریز مبلغ{" "}
                    <b className="text-sea-900">{toman(order.total)}</b> را در حساب
                    خودت دیده باشی — رسیدی که مشتری می‌فرستد به‌تنهایی سند پرداخت
                    نیست. با تأیید، سفارش «پرداخت شده» می‌شود و امتیاز باشگاه به
                    مشتری تعلق می‌گیرد.
                  </>
                )}
              </p>
            </div>
            <form action={approveManualOrder}>
              <input type="hidden" name="id" value={order.id} />
              <button className="btn btn-primary whitespace-nowrap">
                {snapppay ? "تأیید اسنپ‌پی و نهایی‌کردن سفارش" : "تأیید واریز و نهایی‌کردن سفارش"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* items + customer */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <h2 className="mb-4 font-bold text-sea-900">اقلام سفارش</h2>
            <ul className="divide-y divide-sand-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between py-3 text-sm">
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
                    {" "}× {faNum(i.qty)}
                  </span>
                  <span className="font-semibold text-sea-900">{toman(i.unitPrice * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-sand-200 pt-4 text-sm">
              <Row label="جمع کالاها" value={toman(order.goodsTotal || order.total - order.shippingCost)} />
              {order.discount > 0 && <Row label={`تخفیف${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${toman(order.discount)}`} />}
              <Row label="ارسال" value={order.shippingCost ? toman(order.shippingCost) : "پس‌کرایه"} />
              <div className="flex justify-between pt-2 text-base">
                <span className="font-bold text-sea-900">جمع کل</span>
                <span className="price-lg text-sea-900">{toman(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Keyed on the last call to اسنپ‌پی: a redirect back to this page is a
              client navigation, which would otherwise leave the panel showing the
              draft the admin just sent instead of the numbers that came back. */}
          {snapppayIpg && (
            <SnappPayOrderPanel
              key={operations[0]?.id ?? "fresh"}
              orderId={order.id}
              items={order.items.map((i) => ({
                id: i.id,
                nameFa: i.nameFa,
                sizeLabel: i.sizeLabel,
                colorName: i.colorName,
                unitPrice: i.unitPrice,
                qty: i.qty,
              }))}
              discount={order.discount}
              shippingCost={order.shippingCost}
              total={order.total}
              blockedReason={snappBlocked}
              customerRequest={
                pendingCustomerRequest &&
                (pendingCustomerRequest.kind === "UPDATE" || pendingCustomerRequest.kind === "CANCEL")
                  ? {
                      id: pendingCustomerRequest.id,
                      kind: pendingCustomerRequest.kind,
                      summary: pendingCustomerRequest.summary,
                      createdAtLabel: `${faDate(pendingCustomerRequest.createdAt)} — ${faTime(pendingCustomerRequest.createdAt)}`,
                      requestedQty,
                    }
                  : null
              }
              onUpdate={snapppayUpdateOrder}
              onCancel={snapppayCancelOrder}
              onRejectRequest={rejectSnapppayChangeRequest}
            />
          )}

          {operations.length > 0 && (
            <div className="card p-6">
              <h2 className="mb-4 font-bold text-sea-900">تاریخچه درخواست‌های اسنپ‌پی</h2>
              <ul className="divide-y divide-sand-100">
                {operations.map((op) => (
                  <li
                    key={op.id}
                    className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 py-3 text-sm"
                  >
                    <div className="min-w-52 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip bg-sand-100 text-ink/82">
                          {OPERATION_FA[op.kind] ?? op.kind}
                        </span>
                        <span
                          className={`chip ${
                            op.status === "OK"
                              ? "bg-sea-100 text-sea-700"
                              : op.status === "UNKNOWN"
                                ? "bg-gold/20 text-ink/82"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {op.status === "OK"
                            ? "موفق ✓"
                            : op.status === "UNKNOWN"
                              ? "نامشخص ؟"
                              : "ناموفق"}
                          {op.code !== null && <span dir="ltr"> ({faNum(op.code)})</span>}
                        </span>
                        <span className="text-xs text-ink/50">
                          {faDate(op.createdAt)} — {faTime(op.createdAt)}
                        </span>
                      </div>
                      {op.message && <p className="mt-1.5 leading-7 text-ink/75">{op.message}</p>}
                    </div>
                    <div className="text-left text-xs leading-6 text-ink/60">
                      {op.amountRial !== null && (
                        <div className="font-semibold text-sea-900">{toman(op.amountRial / 10)}</div>
                      )}
                      {op.userName && <div>{op.userName}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-6 text-sm leading-8 text-ink/82">
            <h2 className="mb-3 font-bold text-sea-900">گیرنده</h2>
            <p><b className="text-sea-900">{order.fullName}</b> · <span dir="ltr">{order.phone}</span></p>
            <p>{order.province ? `${order.province}، ` : ""}{order.city}، {order.address}{order.unit ? `، ${order.unit}` : ""}</p>
            {order.postalCode && <p>کدپستی: <span dir="ltr">{order.postalCode}</span></p>}
            {order.note && <p className="mt-2 rounded-xl bg-sand-100 px-3 py-2 text-xs text-clay-700">یادداشت: {order.note}</p>}
          </div>
        </div>

        {/* fulfilment sidebar */}
        <div className="space-y-6">
          <form action={setTracking} className="card space-y-4 p-6">
            <input type="hidden" name="id" value={order.id} />
            <h2 className="font-bold text-sea-900">ارسال و پیگیری</h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-sea-900">کد رهگیری تیپاکس</label>
              <input
                name="trackingCode"
                dir="ltr"
                defaultValue={order.trackingCode ?? ""}
                placeholder="کد مرسوله را این‌جا بزن"
                className="input"
              />
              <p className="mt-1.5 text-xs text-ink/55">
                با ثبت کد، اگر سفارش «پرداخت شده» باشد به‌صورت خودکار «ارسال شده» می‌شود و به مشتری نمایش داده می‌شود.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-sea-900">وضعیت</label>
              <select name="status" defaultValue={order.status} className="input">
                {Object.entries(ORDER_STATUS_FA).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary w-full">ذخیره</button>
          </form>

          {snapppay && (
            <SnappPayPlan total={order.total} approvedAt={order.snapppayApprovedAt} />
          )}

          {paid && (
            <div className="card p-6 text-sm">
              <h2 className="mb-3 font-bold text-sea-900">پرداخت</h2>
              <Row label="وضعیت" value="موفق ✓" />
              <Row label="مبلغ" value={toman(paid.amountRial / 10)} />
              {paid.rrn && <Row label="مرجع بانکی (RRN)" value={paid.rrn} ltr />}
              {paid.maskedPan && <Row label="کارت" value={paid.maskedPan} ltr />}
              {paid.paidAt && <Row label="زمان" value={`${faDate(paid.paidAt)} ${faTime(paid.paidAt)}`} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-ink/60">{label}</span>
      <span className="font-semibold text-sea-900" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
