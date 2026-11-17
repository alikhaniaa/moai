import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { priceCart, blockedMessage } from "@/lib/pricing";
import { takeStock } from "@/lib/stock";
import { applyCoupon, shippingCostFor } from "@/lib/coupon";
import { faNum } from "@/lib/format";
import { digipayEnabled } from "@/lib/digipay";
import { snapppayEnabledFor } from "@/lib/snapppay-api";

/**
 * Creates the order, unpaid.
 *
 * Prices, campaigns, the discount code and shipping are all recalculated here
 * from the database. The browser's numbers are only ever a preview.
 *
 * Four routes out of here:
 *   GATEWAY      → AWAITING_PAYMENT;  stock and points wait for the bank's callback.
 *   DIGIPAY      → AWAITING_PAYMENT;  same, on دیجی‌پی's verified callback.
 *   SNAPPPAY_IPG → AWAITING_PAYMENT;  same, on اسنپ‌پی's verified callback.
 *   CARD         → AWAITING_TRANSFER; goods reserved now, points wait for the
 *                  shop to confirm the کارت به کارت receipt by hand.
 *
 * SNAPPPAY - the *by-hand* اسنپ‌پی, arranged over واتس‌اپ - is still NOT one of
 * them: it never becomes an order here. Orders already sitting in
 * AWAITING_SNAPPPAY keep working everywhere else (the buyer's page, the admin
 * approval, the refunds), and when the اسنپ‌پی gateway is switched off that is
 * still the only way اسنپ‌پی is sold.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "ابتدا وارد شو." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const {
    items, firstName, lastName, company, province, city, address, unit,
    postalCode, phone, email, note, shippingMethodId, couponCode, paymentMethod,
  } = body ?? {};

  // The by-hand اسنپ‌پی is not sold on the site - it is arranged over واتس‌اپ
  // and entered by the shop. Refused here rather than quietly downgraded to the
  // gateway, so nobody is charged in full expecting to pay in four. Orders that
  // already exist in AWAITING_SNAPPPAY are untouched and still approvable.
  if (paymentMethod === "SNAPPPAY") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "خرید قسطی با اسنپ‌پی به‌صورت دستی ثبت می‌شود — لطفاً در واتس‌اپ به ما پیام بده تا سفارشت را قسطی ثبت کنیم.",
      },
      { status: 400 }
    );
  }

  // Anything that isn't an explicit manual method goes through the bank, so a
  // malformed or hostile value can never skip payment.
  const cardTransfer = paymentMethod === "CARD";
  // دیجی‌پی is an online gateway like the bank: the buyer pays now, so stock and
  // points wait for its verified callback exactly as they do for SEP.
  const digipay = paymentMethod === "DIGIPAY" && digipayEnabled();
  // The اسنپ‌پی *gateway*: the buyer is financed by اسنپ‌پی and the shop is paid
  // in full, so stock and points wait for its verified callback too. Falls back
  // to the bank if the gateway isn't switched on, exactly like دیجی‌پی - never
  // to the by-hand flow above, which is a different product entirely.
  const snapppay = paymentMethod === "SNAPPPAY_IPG" && snapppayEnabledFor(user.phone);
  // کارت به کارت waits for the shop to confirm, and reserves stock meanwhile.
  const manual = cardTransfer;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "سبد خرید خالی است." }, { status: 400 });
  }

  const required: [unknown, string][] = [
    [firstName, "نام"],
    [lastName, "نام خانوادگی"],
    [province, "استان"],
    [city, "شهر"],
    [address, "آدرس"],
    [phone, "تلفن"],
  ];
  for (const [value, label] of required) {
    if (typeof value !== "string" || value.trim().length < 2) {
      return NextResponse.json({ ok: false, error: `${label} را کامل کن.` }, { status: 400 });
    }
  }
  if (typeof phone === "string" && !/^0\d{10}$/.test(phone.trim())) {
    return NextResponse.json({ ok: false, error: "شماره تلفن معتبر نیست." }, { status: 400 });
  }
  if (email && typeof email === "string" && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return NextResponse.json({ ok: false, error: "ایمیل معتبر نیست." }, { status: 400 });
  }

  const { lines, goods, blocked } = await priceCart(items);

  // A سایز سفارشی line, or a sizeless line for a product that has sizes, is
  // refused here - the product page hides both, but the browser is not the
  // authority on what this shop is willing to sell.
  if (blocked.length > 0) {
    return NextResponse.json({ ok: false, error: blockedMessage(blocked[0]) }, { status: 400 });
  }
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: "محصولات سبد معتبر نیستند." }, { status: 400 });
  }

  // stock is per size once a product has sizes, so this compares against the
  // size row the buyer actually chose, not the product's total
  const short = lines.find((l) => l.qty > l.stock);
  if (short) {
    const variant = [short.sizeLabel, short.colorName].filter(Boolean).join(" / ");
    const what = variant
      ? `«${short.product.nameFa}» (${variant})`
      : `«${short.product.nameFa}»`;
    return NextResponse.json(
      {
        ok: false,
        error:
          short.stock === 0
            ? `${what} متأسفانه تمام شد.`
            : `از ${what} فقط ${faNum(short.stock)} عدد موجود است.`,
      },
      { status: 409 }
    );
  }

  // discount code
  let discount = 0;
  let couponId: string | null = null;
  let couponFreeShipping = false;
  let appliedCode: string | null = null;
  if (typeof couponCode === "string" && couponCode.trim()) {
    // The method is resolved above from the SAME flags the order is created
    // with, so a code barred from instalments cannot be slipped through by
    // validating it as a gateway order and then paying in four.
    const result = await applyCoupon(
      couponCode,
      goods,
      user.id,
      cardTransfer ? "CARD" : digipay ? "DIGIPAY" : snapppay ? "SNAPPPAY_IPG" : "GATEWAY"
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    discount = result.discount;
    couponId = result.id;
    couponFreeShipping = result.freeShipping;
    appliedCode = result.code;
  }

  const method = shippingMethodId
    ? await db.shippingMethod.findFirst({ where: { id: String(shippingMethodId), active: true } })
    : await db.shippingMethod.findFirst({ where: { active: true }, orderBy: { sort: "asc" } });

  const goodsAfterDiscount = Math.max(0, goods - discount);
  const shippingCost = shippingCostFor(method, goodsAfterDiscount, couponFreeShipping);
  const total = goodsAfterDiscount + shippingCost;

  const orderData = {
      userId: user.id,
      paymentMethod: cardTransfer
        ? "CARD"
        : digipay
          ? "DIGIPAY"
          : snapppay
            ? "SNAPPPAY_IPG"
            : "GATEWAY",
      // A manual order waits for the shop to confirm by hand; it must never sit
      // in AWAITING_PAYMENT, or the bank gateway would offer to charge the buyer
      // again for an order they are already settling another way.
      status: cardTransfer ? "AWAITING_TRANSFER" : "AWAITING_PAYMENT",
      // Goods are reserved the moment a manual order is placed, so the last item
      // can't be sold twice while the shop works through the confirmation.
      stockApplied: manual,
      goodsTotal: goods,
      discount,
      shippingCost,
      total,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      company: company?.trim() || null,
      province: province.trim(),
      city: city.trim(),
      address: address.trim(),
      unit: unit?.trim() || null,
      postalCode: postalCode?.trim() || null,
      phone: phone.trim(),
      email: email?.trim() || null,
      note: note?.trim() || null,
      shippingMethodId: method?.id ?? null,
      shippingName: method?.nameFa ?? null,
      couponId,
      couponCode: appliedCode,
      items: {
        create: lines.map((l) => ({
          productId: l.product.id,
          nameFa: l.product.nameFa,
          qty: l.qty,
          unitPrice: l.unitPrice,
          sizeId: l.size?.id ?? null,
          sizeLabel: l.sizeLabel,
          colorId: l.color?.id ?? null,
          colorName: l.colorName,
        })),
      },
  };

  // The reservation and the order are written together: a half-applied version
  // of this (stock taken with no order, or an order holding stock it never took)
  // is exactly the state the shop can't reconcile later.
  const order = manual
    ? (
        await db.$transaction([
          db.order.create({ data: orderData }),
          ...takeStock(
            lines.map((l) => ({
              productId: l.product.id,
              sizeId: l.size?.id ?? null,
              qty: l.qty,
            }))
          ),
        ])
      )[0]
    : await db.order.create({ data: orderData });

  // remember the email for next time
  if (email?.trim() && !user.email) {
    await db.user.update({ where: { id: user.id }, data: { email: email.trim() } });
  }

  // the browser follows the server's routing decision, never its own guess
  return NextResponse.json({
    ok: true,
    orderId: order.id,
    next: cardTransfer
      ? `/checkout/transfer/${order.id}`
      : digipay
        ? `/checkout/digipay/${order.id}`
        : snapppay
          ? `/checkout/snapppay-ipg/${order.id}`
          : `/checkout/pay/${order.id}`,
  });
}
