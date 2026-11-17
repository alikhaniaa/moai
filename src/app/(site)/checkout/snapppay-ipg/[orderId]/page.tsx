import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  paymentToken,
  tomanToRial,
  snapppayEnabledFor,
  eligible,
  isValidSnappMobile,
  newTransactionRef,
} from "@/lib/snapppay-api";
import { snapppayItems } from "@/lib/snapppay-cart";

export const dynamic = "force-dynamic";
export const metadata = { title: "انتقال به اسنپ‌پی" };

/**
 * Hands the buyer over to اسنپ‌پی's instalment page.
 *
 * This is the *gateway* flow (paymentMethod SNAPPPAY_IPG), not the older
 * by-hand one at /checkout/snapppay - that stays exactly as it is, arranged
 * over واتس‌اپ, and never touches this page.
 *
 * Like دیجی‌پی and unlike SEP, اسنپ‌پی gives us a plain `paymentPageUrl`, so
 * this page just sends the browser there. The result comes back to
 * /api/payment/snapppay/callback.
 */
export default async function SnappPayGatewayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/checkout/snapppay-ipg/${orderId}`);

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true },
  });
  if (!order) redirect("/account");

  // Never charge an order that is settling some other way.
  if (order.paymentMethod === "SNAPPPAY") redirect(`/checkout/snapppay/${order.id}`);
  if (order.paymentMethod === "CARD") redirect(`/checkout/transfer/${order.id}`);
  if (order.paymentMethod === "GATEWAY") redirect(`/checkout/pay/${order.id}`);
  if (order.paymentMethod === "DIGIPAY") redirect(`/checkout/digipay/${order.id}`);
  if (order.status !== "AWAITING_PAYMENT") redirect(`/checkout/success?order=${order.id}`);
  const unresolved = await db.payment.findFirst({
    where: { orderId: order.id, provider: "SNAPPPAY", status: { in: ["VERIFYING", "SETTLEMENT_PENDING"] } },
  });
  if (unresolved) redirect(`/checkout/success?order=${order.id}`);

  const settings = await getSettings();
  const wa = `https://wa.me/${settings.shopWhatsapp}?text=${encodeURIComponent(
    `سلام! می‌خواهم سفارش ${order.id.slice(-8).toUpperCase()} را قسطی ثبت کنم.`
  )}`;

  const trouble = (title: string, body: string) => (
    <section className="mx-auto max-w-lg px-6 py-40 text-center">
      <span className="text-5xl">🛠️</span>
      <h1 className="mt-5 font-display text-3xl font-bold text-sea-900">{title}</h1>
      <p className="mt-4 rounded-2xl bg-sand-100 px-5 py-4 text-sm leading-7 text-ink/75">{body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={wa} target="_blank" rel="noopener" className="btn btn-primary">
          هماهنگی در واتس‌اپ
        </a>
        <Link href={`/checkout/pay/${order.id}`} className="btn btn-ghost">
          پرداخت با درگاه بانک
        </Link>
      </div>
    </section>
  );

  if (!snapppayEnabledFor(user.phone)) {
    return trouble(
      "خرید قسطی اسنپ‌پی فعلاً در دسترس نیست",
      "سفارشت ثبت شد. می‌توانی با درگاه بانک پرداخت کنی، یا در واتس‌اپ به ما پیام بدهی تا همان لحظه هماهنگ کنیم."
    );
  }

  // SnappPay validates the mobile against `\+98\d{10}` and refuses anything
  // else outright, so it is worth saying so in Persian rather than showing the
  // buyer a gateway error.
  if (!isValidSnappMobile(order.phone)) {
    return trouble(
      "شماره موبایل این سفارش برای اسنپ‌پی معتبر نیست",
      "برای خرید قسطی، شماره موبایل باید یک شماره همراه ایران باشد. با درگاه بانک پرداخت کن یا در واتس‌اپ به ما بگو تا شماره را اصلاح کنیم."
    );
  }

  const amountRial = tomanToRial(order.total);
  const goodsRial = tomanToRial(order.goodsTotal);
  const discountRial = tomanToRial(order.discount);
  const shippingRial = tomanToRial(order.shippingCost);

  // اسنپ‌پی decides basket by basket - the limits differ between stage and
  // production, so they are never assumed here. Checkout already asked before
  // showing the option; asking again costs one call and stops a buyer who sat
  // on the page while a campaign changed the price.
  const offer = await eligible(amountRial);
  if (offer.ok && !offer.eligible) {
    return trouble(
      "خرید قسطی برای این مبلغ ممکن نیست",
      "اسنپ‌پی این سبد را برای پرداخت اقساطی تأیید نکرد. می‌توانی با درگاه بانک پرداخت کنی یا سبد را تغییر دهی."
    );
  }

  // ── One Payment row per attempt ──────────────────────────────
  // `resNum` doubles as the transactionId sent to اسنپ‌پی: the handle the
  // callback comes back with, the number shown on the buyer's receipt and the
  // one the admin searches by. Nine digits rather than the row's cuid, per the
  // doc's «۵ تا ۱۰ رقم». A repeat is refused by SnappPay with 1009, so the
  // unique index on resNum is what keeps us honest - retry on collision.
  let payment: { id: string; resNum: string } | null = null;
  for (let attempt = 0; attempt < 5 && !payment; attempt++) {
    const resNum = newTransactionRef();
    try {
      payment = await db.payment.create({
        data: { orderId: order.id, provider: "SNAPPPAY", resNum, amountRial },
        select: { id: true, resNum: true },
      });
    } catch {
      // unique-constraint clash on resNum - draw another number and try again
    }
  }
  if (!payment) {
    return trouble(
      "اتصال به اسنپ‌پی ممکن نشد",
      "ثبت تراکنش ناموفق بود. چند لحظه بعد دوباره تلاش کن یا با درگاه بانک پرداخت کن."
    );
  }

  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  // The basket has to balance the way SnappPay documents it, which is NOT the
  // same as the way an order stores its money:
  //   totalAmount = Σ(lines) + shipping + tax   ← before the coupon
  //   amount      = totalAmount − discount
  // order.total is already net of the discount, so the pieces are handed over
  // separately and `buildCartList` does the arithmetic in one place.
  const token = await paymentToken({
    transactionId: payment.resNum,
    returnURL: `${base}/api/payment/snapppay/callback`,
    mobile: order.phone,
    discountRial,
    shippingRial,
    items: snapppayItems(order.items),
  });

  if (!token.ok) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", message: token.error },
    });
    console.log(`[SNAPPPAY] order ${order.id} token failed: ${token.error}`);
    return trouble("اتصال به اسنپ‌پی ممکن نشد", token.error);
  }

  // A basket that doesn't add up to the invoice would have the buyer paying a
  // different number from the one on their order. SnappPay accepts the request
  // either way, so this is our check, not theirs.
  if (token.amountRial !== amountRial) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        message: `مبلغ سبد اسنپ‌پی (${token.amountRial}) با فاکتور (${amountRial}) نمی‌خواند.`,
      },
    });
    console.log(
      `[SNAPPPAY] ⚠ order ${order.id} basket ${token.amountRial} ≠ invoice ${amountRial} Rial ` +
        `(goods ${goodsRial} − discount ${discountRial} + shipping ${shippingRial})`
    );
    return trouble(
      "مبلغ سبد خرید با فاکتور نمی‌خواند",
      "برای این‌که چیزی اشتباه از حسابت کم نشود، پرداخت متوقف شد. لطفاً در واتس‌اپ به ما خبر بده."
    );
  }

  // The paymentToken must be stored BEFORE the buyer leaves: every follow-up
  // call needs it, and without it the callback can neither settle the purchase
  // nor revert it.
  await db.payment.update({
    where: { id: payment.id },
    data: { token: token.paymentToken },
  });
  redirect(token.paymentPageUrl);
}
