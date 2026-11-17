import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toman, faNum, orderCode, ORDER_STATUS_FA } from "@/lib/format";
import { splitInstallments } from "@/lib/snapppay";
import SnappPayPlan from "@/components/SnappPayPlan";

export const dynamic = "force-dynamic";
export const metadata = { title: "خرید قسطی اسنپ‌پی" };

/**
 * Where a SnappPay order lands after checkout.
 *
 * No gateway is involved: the order exists, the goods are reserved, and the
 * buyer finishes registration with us over WhatsApp. The page therefore has to
 * work when re-opened days later from «حساب کاربری», which is why it renders
 * from the order's current status rather than assuming a fresh checkout.
 */
export default async function SnappPayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/checkout/snapppay/${orderId}`);

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true },
  });
  if (!order) redirect("/account");
  // A gateway order has no business here - send it to the bank flow instead.
  if (order.paymentMethod !== "SNAPPPAY") redirect(`/checkout/pay/${order.id}`);

  const settings = await getSettings();
  const code = orderCode(order.id);
  const waiting = order.status === "AWAITING_SNAPPPAY";
  const cancelled = order.status === "CANCELLED";
  const first = splitInstallments(order.total)[0];

  const waText = [
    `سلام! سفارش ${code} را با خرید قسطی اسنپ‌پی ثبت کردم.`,
    `مبلغ کل: ${order.total.toLocaleString("fa-IR")} تومان`,
    `قسط اول: ${first.toLocaleString("fa-IR")} تومان`,
    `برای ثبت‌نام اسنپ‌پی راهنمایی‌ام کنید.`,
  ].join("\n");
  const wa = `https://wa.me/${settings.shopWhatsapp}?text=${encodeURIComponent(waText)}`;

  return (
    <section className="mx-auto max-w-2xl px-6 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="text-center">
        <div
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${
            cancelled ? "bg-red-50" : waiting ? "bg-[#007DFA]/10" : "bg-sea-100"
          }`}
        >
          {cancelled ? "✕" : waiting ? "📝" : "🎉"}
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-sea-900 md:text-4xl">
          {cancelled
            ? "این سفارش لغو شده است"
            : waiting
              ? "سفارشت ثبت شد!"
              : "سفارش اقساطی تأیید شد"}
        </h1>
        <p className="mt-3 text-sm text-ink/68">
          کد پیگیری:{" "}
          <span className="font-bold text-clay-600" dir="ltr">#{code}</span>
          <span className="mx-2 text-ink/30">|</span>
          {ORDER_STATUS_FA[order.status] ?? order.status}
        </p>
      </div>

      {waiting && (
        <div className="card mt-8 p-6 md:p-7">
          <h2 className="font-bold text-sea-900">مرحله‌ی بعد: پیام در واتس‌اپ</h2>
          <p className="mt-2 text-sm leading-7 text-ink/78">
            برای نهایی‌کردن خرید اقساطی، ثبت‌نام اسنپ‌پی را با هم انجام می‌دهیم.
            روی دکمه‌ی زیر بزن تا گفتگو با کد سفارشت باز شود — کالاها تا آن زمان
            برایت کنار گذاشته شده‌اند.
          </p>
          <a
            href={wa}
            target="_blank"
            rel="noopener"
            className="btn btn-primary mt-5 w-full text-base"
          >
            ادامه در واتس‌اپ
          </a>
          <p className="mt-3 text-center text-xs text-ink/55">
            سفارش پس از تأیید ما نهایی می‌شود. این صفحه همیشه از «حساب کاربری»
            در دسترس است.
          </p>
        </div>
      )}

      {!waiting && !cancelled && (
        <p className="card mt-8 p-6 text-sm leading-7 text-ink/78">
          ثبت‌نام اسنپ‌پی تأیید شد و سفارشت در حال آماده‌سازی است. اقساط بعدی را
          اسنپ‌پی از تو دریافت می‌کند.
        </p>
      )}

      <div className="mt-6">
        <SnappPayPlan total={order.total} approvedAt={order.snapppayApprovedAt} />
      </div>

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
