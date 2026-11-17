import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createTicket, tomanToRial, digipayEnabled } from "@/lib/digipay";

export const dynamic = "force-dynamic";
export const metadata = { title: "انتقال به دیجی‌پی" };

/**
 * Hands the buyer over to دیجی‌پی.
 *
 * Unlike SEP - which needs a form POST so the Referrer header is sent - DigiPay
 * gives us a plain `redirectUrl`, so this page just sends the browser there.
 */
export default async function DigipayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/checkout/digipay/${orderId}`);

  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id } });
  if (!order) redirect("/account");

  // Never charge an order that is settling some other way.
  if (order.paymentMethod === "SNAPPPAY") redirect(`/checkout/snapppay/${order.id}`);
  if (order.paymentMethod === "CARD") redirect(`/checkout/transfer/${order.id}`);
  if (order.paymentMethod === "GATEWAY") redirect(`/checkout/pay/${order.id}`);
  if (order.paymentMethod === "SNAPPPAY_IPG") redirect(`/checkout/snapppay-ipg/${order.id}`);
  if (order.status !== "AWAITING_PAYMENT") redirect(`/checkout/success?order=${order.id}`);

  const settings = await getSettings();
  const wa = `https://wa.me/${settings.shopWhatsapp}?text=${encodeURIComponent(
    `سلام! می‌خواهم سفارش ${order.id.slice(-8).toUpperCase()} را ثبت کنم.`
  )}`;

  const trouble = (title: string, body: string) => (
    <section className="mx-auto max-w-lg px-6 py-40 text-center">
      <span className="text-5xl">🛠️</span>
      <h1 className="mt-5 font-display text-3xl font-bold text-sea-900">{title}</h1>
      <p className="mt-4 rounded-2xl bg-sand-100 px-5 py-4 text-sm leading-7 text-ink/75">{body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={wa} target="_blank" rel="noopener" className="btn btn-primary">
          ثبت سفارش در واتس‌اپ
        </a>
        <Link href={`/checkout/pay/${order.id}`} className="btn btn-ghost">
          پرداخت با درگاه بانک
        </Link>
      </div>
    </section>
  );

  if (!digipayEnabled()) {
    return trouble(
      "پرداخت با دیجی‌پی فعلاً در دسترس نیست",
      "سفارشت ثبت شد. می‌توانی با درگاه بانک پرداخت کنی، یا در واتس‌اپ به ما پیام بدهی تا همان لحظه هماهنگ کنیم."
    );
  }

  const amountRial = tomanToRial(order.total);

  // one Payment row per attempt; its id doubles as the providerId sent to DigiPay
  const payment = await db.payment.create({
    data: { orderId: order.id, provider: "DIGIPAY", resNum: "", amountRial },
  });
  await db.payment.update({ where: { id: payment.id }, data: { resNum: payment.id } });

  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const ticket = await createTicket({
    amountRial,
    providerId: payment.id,
    callbackUrl: `${base}/api/payment/digipay/callback`,
    cellNumber: order.phone,
  });

  if (!ticket.ok) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", message: ticket.error },
    });
    console.log(`[DIGIPAY] order ${order.id} ticket failed: ${ticket.error}`);
    return trouble("اتصال به دیجی‌پی ممکن نشد", ticket.error);
  }

  await db.payment.update({ where: { id: payment.id }, data: { token: ticket.ticket } });
  redirect(ticket.redirectUrl);
}
