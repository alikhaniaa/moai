import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { toman } from "@/lib/format";
import {
  requestToken,
  tomanToRial,
  sepSandbox,
  SEP_PAY_URL,
} from "@/lib/sep";
import GatewayRedirect from "@/components/GatewayRedirect";

export const dynamic = "force-dynamic";
export const metadata = { title: "انتقال به درگاه پرداخت" };

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/checkout/pay/${orderId}`);

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
  });
  if (!order) redirect("/account");
  // A manually-settled order is never charged through the bank - it would take
  // the amount a second time from a buyer already paying another way.
  if (order.paymentMethod === "SNAPPPAY") redirect(`/checkout/snapppay/${order.id}`);
  if (order.paymentMethod === "CARD") redirect(`/checkout/transfer/${order.id}`);
  if (order.paymentMethod === "DIGIPAY") redirect(`/checkout/digipay/${order.id}`);
  if (order.paymentMethod === "SNAPPPAY_IPG") redirect(`/checkout/snapppay-ipg/${order.id}`);
  if (order.status !== "AWAITING_PAYMENT") redirect(`/checkout/success?order=${order.id}`);

  const amountRial = tomanToRial(order.total);

  // one Payment row per attempt; its id doubles as the ResNum sent to SEP
  const payment = await db.payment.create({
    data: { orderId: order.id, provider: "SEP", resNum: "", amountRial },
  });
  await db.payment.update({
    where: { id: payment.id },
    data: { resNum: payment.id },
  });

  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectUrl = `${base}/api/payment/callback`;

  // Sandbox: skip the bank entirely and post to our own fake gateway.
  if (sepSandbox()) {
    return (
      <GatewayRedirect
        action="/api/payment/sandbox"
        token={payment.id}
        amountLabel={toman(order.total)}
        sandbox
      />
    );
  }

  const result = await requestToken({
    amountRial,
    resNum: payment.id,
    redirectUrl,
    cellNumber: order.phone,
  });

  if (!result.ok) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", message: result.error },
    });
    // The bank rejecting our IP means SEP hasn't finished registering the
    // server yet - show a reassuring message + a WhatsApp way to order, rather
    // than a scary error, so no sale is lost during the setup window.
    const gatewayPending = /آی‌پی|آدرس سرور|مجاز نیست|IpAddress|ثبت نشده/i.test(result.error);
    const wa = `https://wa.me/989121230000?text=${encodeURIComponent(
      `سلام! می‌خواهم سفارش ${order.id.slice(-8).toUpperCase()} را ثبت کنم.`
    )}`;
    return (
      <section className="mx-auto max-w-lg px-6 py-40 text-center">
        <span className="text-5xl">{gatewayPending ? "🛠️" : "⚠️"}</span>
        <h1 className="mt-5 font-display text-3xl font-bold text-sea-900">
          {gatewayPending ? "درگاه پرداخت به‌زودی فعال می‌شود" : "اتصال به درگاه ممکن نشد"}
        </h1>
        <p className="mt-4 rounded-2xl bg-sand-100 px-5 py-4 text-sm leading-7 text-ink/75">
          {gatewayPending
            ? "پرداخت آنلاین در حال راه‌اندازی نهایی است. سفارشت ثبت شد؛ برای نهایی‌کردن خرید در واتس‌اپ به ما پیام بده تا همان لحظه هماهنگ کنیم."
            : result.error}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={wa} target="_blank" rel="noopener" className="btn btn-primary">
            ثبت سفارش در واتس‌اپ
          </a>
          <Link href={`/checkout/pay/${order.id}`} className="btn btn-ghost">
            تلاش دوباره برای پرداخت
          </Link>
        </div>
      </section>
    );
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { token: result.token },
  });

  return (
    <GatewayRedirect
      action={SEP_PAY_URL}
      token={result.token}
      amountLabel={toman(order.total)}
    />
  );
}
