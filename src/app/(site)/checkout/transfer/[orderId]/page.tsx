import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toman, faNum, orderCode, ORDER_STATUS_FA } from "@/lib/format";
import CardTransferBox from "@/components/CardTransferBox";

export const dynamic = "force-dynamic";
export const metadata = { title: "پرداخت کارت به کارت" };

/**
 * Where a کارت به کارت order lands after checkout.
 *
 * The buyer transfers the exact total to the shop's card and sends the receipt
 * on WhatsApp; the shop confirms by hand. Like the SnappPay page, this renders
 * from the order's current status so it still makes sense when re-opened later
 * from «حساب کاربری».
 */
export default async function TransferPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/checkout/transfer/${orderId}`);

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true },
  });
  if (!order) redirect("/account");
  if (order.paymentMethod !== "CARD") redirect(`/checkout/pay/${order.id}`);

  const settings = await getSettings();
  const code = orderCode(order.id);
  const waiting = order.status === "AWAITING_TRANSFER";
  const cancelled = order.status === "CANCELLED";

  const waText = [
    `سلام! سفارش ${code} را ثبت کردم و مبلغ ${order.total.toLocaleString("fa-IR")} تومان را کارت به کارت می‌کنم.`,
    `رسید واریز را همین‌جا می‌فرستم.`,
  ].join("\n");
  const wa = `https://wa.me/${settings.shopWhatsapp}?text=${encodeURIComponent(waText)}`;

  return (
    <section className="mx-auto max-w-2xl px-6 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="text-center">
        <div
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${
            cancelled ? "bg-red-50" : waiting ? "bg-gold/20" : "bg-sea-100"
          }`}
        >
          {cancelled ? "✕" : waiting ? "🧾" : "🎉"}
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-sea-900 md:text-4xl">
          {cancelled
            ? "این سفارش لغو شده است"
            : waiting
              ? "سفارشت ثبت شد!"
              : "پرداخت تأیید شد"}
        </h1>
        <p className="mt-3 text-sm text-ink/68">
          کد پیگیری:{" "}
          <span className="font-bold text-clay-600" dir="ltr">#{code}</span>
          <span className="mx-2 text-ink/30">|</span>
          {ORDER_STATUS_FA[order.status] ?? order.status}
        </p>
      </div>

      {waiting && (
        <>
          <div className="card mt-8 p-6 md:p-7">
            <h2 className="font-bold text-sea-900">۱. مبلغ را کارت به کارت کن</h2>
            <p className="mt-2 text-sm leading-7 text-ink/78">
              مبلغ <b className="text-sea-900">{toman(order.total)}</b> را به کارت زیر
              واریز کن. کالاها تا زمان تأیید برایت کنار گذاشته شده‌اند.
            </p>
            <div className="mt-4">
              <CardTransferBox
                cardNumber={settings.cardNumber}
                cardHolder={settings.cardHolder}
                cardBank={settings.cardBank}
                amountLabel={toman(order.total)}
                amountRaw={order.total}
              />
            </div>
          </div>

          <div className="card mt-6 p-6 md:p-7">
            <h2 className="font-bold text-sea-900">۲. رسید را در واتس‌اپ بفرست</h2>
            <p className="mt-2 text-sm leading-7 text-ink/78">
              تصویر رسید را همراه کد سفارش برای ما بفرست تا پرداخت را تأیید کنیم و
              سفارشت آماده‌ی ارسال شود.
            </p>
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              className="btn btn-primary mt-5 w-full text-base"
            >
              ارسال رسید در واتس‌اپ
            </a>
            <p className="mt-3 text-center text-xs text-ink/55">
              این صفحه همیشه از «حساب کاربری» در دسترس است.
            </p>
          </div>
        </>
      )}

      {!waiting && !cancelled && (
        <p className="card mt-8 p-6 text-sm leading-7 text-ink/78">
          واریزت تأیید شد و سفارشت در حال آماده‌سازی است. ممنون از خریدت 🧡
        </p>
      )}

      <div className="card mt-6 p-6">
        <h2 className="mb-4 font-bold text-sea-900">اقلام سفارش</h2>
        <ul className="space-y-3 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span className="text-ink/80">
                {i.nameFa}
                {i.sizeLabel && <span className="text-sea-700"> — سایز {i.sizeLabel}</span>}
                {i.colorName && <span className="text-clay-700"> — رنگ {i.colorName}</span>}
                {" "}× {faNum(i.qty)}
              </span>
              <span className="font-semibold text-sea-900">{toman(i.unitPrice * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-sand-200 pt-4 text-sm">
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-ink/72">تخفیف</span>
              <span className="font-semibold text-sea-600">− {toman(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-ink/72">ارسال</span>
            <span className="font-semibold text-sea-900">
              {order.shippingCost ? toman(order.shippingCost) : "پس‌کرایه"}
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-bold text-sea-900">جمع کل</span>
            <span className="price-lg text-sea-900">{toman(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="btn btn-ghost">سفارش‌های من</Link>
        <Link href="/products" className="btn btn-ghost">ادامه خرید</Link>
      </div>
    </section>
  );
}
