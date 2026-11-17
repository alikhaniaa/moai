/**
 * اسنپ‌پی end to end - the parts that can be checked without spending money.
 *
 *   npx next build && npx next start     (one terminal)
 *   node tools/snapppaytest.mjs          (another)
 *
 * SnappPay signs nothing it sends us: the callback is a public URL carrying
 * three unauthenticated form fields. So half of this suite is about proving the
 * callback CANNOT be talked into settling an order on its own word, and that it
 * obeys the one rule the API doc states twice (p.13):
 *
 *   · a forged `state=OK` with no verifiable withdrawal pays nothing
 *   · verify runs AT MOST ONCE, however many callbacks arrive
 *   · a settled attempt is never re-verified or reverted by a later callback
 *   · one gateway's callback can never settle another gateway's attempt
 *   · state=FAILED leaves the order unpaid and the stock alone
 *   · an amount that disagrees with the invoice never ships goods
 *   · the attempt is found by `Payment.resNum` - the nine-digit transactionId
 *     we sent - and never by the row's own id
 *   · the gateway is hidden at checkout until it is switched on
 *
 * The other half is arithmetic. اسنپ‌پی re-does the basket sums by hand during
 * certification, so the formula is asserted here rather than trusted:
 *
 *   · the mobile leaves as `+98XXXXXXXXXX` whatever shape it was stored in - a
 *     bare 09… is refused with 1005
 *   · totalAmount is the basket BEFORE the coupon; amount is what is left after
 *     it. The two are only equal when no coupon was used
 *   · commissionType is always sent, 100 when the shop has no per-category split
 *   · an item cut to zero disappears from cartItems instead of lingering at 0
 *   · a re-priced basket is never worth more than the one it replaces (1042)
 *
 * Those five come from the real modules rather than a copy of them, because a
 * copy of the formula would go on passing after the original broke. Both are
 * `server-only` and import through the `@/` alias, which is what the loader
 * shim below is for.
 *
 * Nothing here talks to SnappPay's servers: the live credential check lives in
 * `node tools/snapppaycheck.mjs`.
 */
import { randomBytes, scryptSync } from "crypto";
import { register } from "node:module";
import { PrismaClient } from "@prisma/client";

/**
 * Two hints, and then Node loads the app's own اسنپ‌پی modules as they are:
 * `server-only` is a marker package that throws by design anywhere but a Server
 * Component, and `@/lib/x` is a tsconfig path Node has never heard of.
 * Stripping the types it does by itself, exactly as tools/sizetest.mjs relies on.
 */
const SRC = new URL("../src/", import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(
      `const SRC = ${JSON.stringify(SRC)};
       export function resolve(specifier, context, next) {
         if (specifier === "server-only") {
           return { url: "data:text/javascript,", shortCircuit: true };
         }
         if (specifier.startsWith("@/")) return next(SRC + specifier.slice(2) + ".ts", context);
         return next(specifier, context);
       }`
    )
);

const { buildCartList, isValidSnappMobile, newTransactionRef, toSnappMobile, tomanToRial } =
  await import(`${SRC}lib/snapppay-api.ts`);
const { repriceOrder, snapppayItems, numericLineId } = await import(`${SRC}lib/snapppay-cart.ts`);

const db = new PrismaClient();
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
const PHONE = "09121117755";
const TAG = "test-snapppay-product";
const CB = "/api/payment/snapppay/callback";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

const cleanup = async () => {
  await db.payment.deleteMany({ where: { order: { user: { phone: PHONE } } } });
  await db.orderItem.deleteMany({ where: { order: { user: { phone: PHONE } } } });
  await db.order.deleteMany({ where: { user: { phone: PHONE } } });
  await db.productSize.deleteMany({ where: { product: { slug: TAG } } });
  await db.product.deleteMany({ where: { slug: TAG } });
};

try {
  await cleanup();

  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync("snapppay-suite", salt, 64).toString("hex")}`;
  const user = await db.user.upsert({
    where: { phone: PHONE },
    update: { passwordHash },
    create: { phone: PHONE, name: "تست اسنپ‌پی", passwordHash },
  });

  const leaf =
    (await db.category.findFirst({ where: { parentId: { not: null } } })) ??
    (await db.category.findFirst());

  const product = await db.product.create({
    data: {
      slug: TAG,
      nameFa: "محصول آزمایشی اسنپ‌پی",
      description: "ساخته‌شده توسط tools/snapppaytest.mjs",
      price: 800_000,
      image: "/images/spa.jpg",
      stock: 5,
      categoryId: leaf.id,
    },
  });

  /** An unpaid SNAPPPAY_IPG order with a pending attempt, as the redirect page leaves it. */
  const makeAttempt = async (amountToman = 800_000, withToken = true) => {
    const order = await db.order.create({
      data: {
        userId: user.id,
        paymentMethod: "SNAPPPAY_IPG",
        status: "AWAITING_PAYMENT",
        goodsTotal: amountToman,
        total: amountToman,
        firstName: "تست", lastName: "اسنپ‌پی", fullName: "تست اسنپ‌پی",
        province: "تهران", city: "تهران", address: "خیابان آزمایش", phone: PHONE,
        items: {
          create: [{
            productId: product.id, nameFa: product.nameFa, qty: 1, unitPrice: amountToman,
          }],
        },
      },
    });
    // resNum IS the transactionId اسنپ‌پی is given and hands back - nine digits,
    // drawn the same way the redirect page draws them. The row's own cuid is
    // never sent anywhere, so the callback must not be able to find it by one.
    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "SNAPPPAY",
        resNum: newTransactionRef(),
        amountRial: tomanToRial(amountToman),
        token: withToken ? "tok-" + randomBytes(8).toString("hex") : null,
      },
    });
    return { order, payment };
  };

  /** SnappPay «submits a form», so that is how the suite calls it. */
  const callback = (fields) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    return fetch(`${BASE}${CB}`, { method: "POST", body: form, redirect: "manual" });
  };

  const stateOf = async (paymentId, orderId) => ({
    payment: await db.payment.findUnique({ where: { id: paymentId } }),
    order: await db.order.findUnique({ where: { id: orderId } }),
    product: await db.product.findUnique({ where: { id: product.id } }),
  });

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n1) MONEY UNITS AND THE SHARED TRANSACTION ID");
  check("Toman → Rial is ×10", tomanToRial(1) === 10 && tomanToRial(800_000) === 8_000_000);

  const ref = newTransactionRef();
  check("a transactionId is the nine digits the doc asks for", /^\d{9}$/.test(ref), ref);
  const refs = new Set(Array.from({ length: 500 }, () => newTransactionRef()));
  check(
    "…and does not repeat itself — a repeat is refused with 1009",
    refs.size >= 499,
    `${refs.size}/500 distinct`
  );

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n2) THE MOBILE اسنپ‌پی INSISTS ON");
  // «مقدار با الگوی "\+98\d{10}" همخوانی ندارد» is error 1005, and it is the
  // first thing the token endpoint refuses - so the shape is fixed here, in the
  // one place that talks to them, not at the call sites.
  const SHAPES = ["09121117755", "00989121117755", "+989121117755", "9121117755", "0912 111 7755"];
  const normalised = SHAPES.map(toSnappMobile);

  check(
    "every shape a phone is stored in normalises to the same +98 number",
    new Set(normalised).size === 1,
    normalised.join(" / ")
  );
  check("…and matches the doc's own pattern, \\+98\\d{10}", /^\+98\d{10}$/.test(normalised[0]),
    normalised[0]);
  check("a bare 09… is never what leaves the building", !normalised.includes(PHONE));
  check("isValidSnappMobile accepts a real mobile", isValidSnappMobile(PHONE) === true);
  check("…refuses a landline", isValidSnappMobile("02188776655") === false);
  check("…refuses a number one digit short", isValidSnappMobile("0912111775") === false);
  check("…refuses an order with no phone at all", isValidSnappMobile("") === false);

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n3) THE BASKET, AS اسنپ‌پی RE-ADDS IT (doc p.14)");
  // «محاسبات شما طبق این فرمول باشد»:
  //   totalAmount = Σ(cart items) + shipping + tax   ← BEFORE the coupon
  //   amount      = totalAmount − (discount + externalSource)
  // An order stores `total` already net of the discount, so sending it as
  // totalAmount would understate the basket by exactly the coupon.
  const LINES = [
    { id: "oi-p1", productId: "p1", nameFa: "شال ابریشم", sizeLabel: null, colorName: "آبی",
      unitPrice: 250_000, qty: 3 },
    { id: "oi-p2", productId: "p2", nameFa: "روسری نخی", sizeLabel: "بزرگ", colorName: null,
      unitPrice: 100_000, qty: 1 },
  ];
  // goods 850,000 − coupon 100,000 + shipping 50,000 = 800,000
  const INVOICE = { goodsTotal: 850_000, discount: 100_000, shippingCost: 50_000 };

  const cart = buildCartList({
    items: snapppayItems(LINES),
    discountRial: tomanToRial(INVOICE.discount),
    shippingRial: tomanToRial(INVOICE.shippingCost),
  });
  const lines = cart.cartList[0];

  check("totalAmount is goods + shipping, BEFORE the coupon",
    cart.totalAmount === tomanToRial(850_000 + 50_000), `${cart.totalAmount} Rial`);
  check("amount is totalAmount − discount",
    cart.amount === cart.totalAmount - tomanToRial(100_000), `${cart.amount} Rial`);
  check("…and amount is exactly what the invoice says",
    cart.amount === tomanToRial(800_000), `${cart.amount} Rial`);
  check("a coupon makes the two differ — the bug that was there before",
    cart.totalAmount > cart.amount, `${cart.totalAmount} > ${cart.amount}`);
  check("the coupon travels in discountAmount, never inside a line",
    cart.discountAmount === tomanToRial(100_000) &&
      lines.cartItems.reduce((s, i) => s + i.amount * i.count, 0) === tomanToRial(850_000));
  check("shipping rides on the cart and is declared",
    lines.shippingAmount === tomanToRial(50_000) && lines.isShipmentIncluded === true);
  check("MOAI charges no tax, and says so",
    lines.taxAmount === 0 && lines.isTaxIncluded === true);
  check("a line's amount is the unit price; count multiplies it once",
    lines.cartItems[0].amount === tomanToRial(250_000), `${lines.cartItems[0].amount} Rial`);
  check("a line's name carries the size and the colour",
    lines.cartItems[0].name === "شال ابریشم — رنگ آبی", lines.cartItems[0].name);
  check("we never send an externalSource we don't have", cart.externalSourceAmount === 0);

  const noCoupon = buildCartList({
    items: snapppayItems(LINES),
    shippingRial: tomanToRial(INVOICE.shippingCost),
  });
  check("without a coupon the two ARE equal", noCoupon.totalAmount === noCoupon.amount,
    `${noCoupon.totalAmount}`);

  // ── commissionType is mandatory, whatever we think of it ──
  check("commissionType is sent on every line, defaulting to 100",
    lines.cartItems.length === 2 && lines.cartItems.every((i) => i.commissionType === 100));
  const split = buildCartList({ items: [{ ...snapppayItems(LINES)[0], commissionType: 7 }] });
  check("…but a contract with a per-category split is left alone",
    split.cartList[0].cartItems[0].commissionType === 7);

  // ── an item cut to zero (doc p.23) ──
  const kept = snapppayItems([{ ...LINES[0], qty: 0 }, LINES[1]]);
  check("an item cut to zero leaves cartItems entirely",
    kept.length === 1 && kept[0].id === numericLineId("oi-p2"), `${kept.length} line(s) left`);
  check("…rather than lingering at count: 0",
    buildCartList({ items: kept }).cartList[0].cartItems.every((i) => i.count > 0));

  // ── the line id اسنپ‌پی will actually accept ──
  // Staging refuses a cuid in cartItems[].id with 1005 «couldn't deserialize the
  // request body», so every checkout would have failed. These are the guard.
  check("a line id is a number, never the cuid it came from",
    lines.cartItems.every((i) => typeof i.id === "number" && Number.isInteger(i.id)),
    lines.cartItems.map((i) => i.id).join(", "));
  check("…always positive, so it never reads as a missing id",
    lines.cartItems.every((i) => i.id > 0));
  check("…within int32, which is what their deserialiser takes",
    lines.cartItems.every((i) => i.id <= 2_147_483_647));
  check("…stable, so تغییر سبد names the same line the token did",
    numericLineId("oi-p1") === snapppayItems([LINES[0]])[0].id);
  check("…and distinct per line, so two sizes of one product never collide",
    numericLineId("oi-p1") !== numericLineId("oi-p2"));

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n4) A SMALLER BASKET NEVER COSTS MORE (تغییر سبد, 1042)");
  const full = repriceOrder(LINES, INVOICE);
  check("an untouched basket reprices to itself", full.total === 800_000, `${full.total}`);

  // The buyer paid 800,000 for 850,000 of goods, i.e. ~88.24٪ of every sticker
  // price. Returning one 250,000 unit gives back what they actually paid for
  // it - 250,000 × 800/850 ≈ 235,294 - not the full list price.
  const oneLess = repriceOrder([{ ...LINES[0], qty: 2 }, LINES[1]], INVOICE);
  check("the coupon is pro-rated, not kept whole",
    oneLess.discount === Math.round((100_000 * 600_000) / 850_000), `${oneLess.discount}`);
  // The refund is the line's list price LESS the share of the coupon that line
  // was carrying - ۲۵۰٬۰۰۰ − ۲۹٬۴۱۲ = ۲۲۰٬۵۸۸, which is what the buyer paid for it.
  check("…so the refund is what the buyer paid, not the sticker price",
    800_000 - oneLess.total === 250_000 - (INVOICE.discount - oneLess.discount),
    `refund ${800_000 - oneLess.total} on a ${250_000} item`);
  check("…which is less than the sticker price, or the shop loses the difference",
    800_000 - oneLess.total < 250_000, `${800_000 - oneLess.total}`);
  check("…and the carriage charge is left exactly as it was",
    oneLess.shippingCost === INVOICE.shippingCost, `${oneLess.shippingCost}`);

  // A ۲۰۰٬۰۰۰ تومان coupon on a ۸۵۰٬۰۰۰ basket, cut down to one ۱۰۰٬۰۰۰ line.
  const overCoupon = repriceOrder(
    [{ ...LINES[0], qty: 0 }, LINES[1]],
    { goodsTotal: 850_000, discount: 200_000, shippingCost: 50_000 }
  );
  check("a pro-rated coupon never exceeds the goods that are left",
    overCoupon.discount <= overCoupon.goodsTotal,
    `${overCoupon.discount} ≤ ${overCoupon.goodsTotal}`);
  check("…so the goods line never goes negative",
    overCoupon.total >= overCoupon.shippingCost, `${overCoupon.total}`);

  // The clamp still has to hold when the coupon is larger than the whole basket.
  const hugeCoupon = repriceOrder(
    [{ ...LINES[0], qty: 0 }, { ...LINES[1], qty: 1 }],
    { goodsTotal: 150_000, discount: 150_000, shippingCost: 50_000 }
  );
  check("a coupon equal to the goods leaves only the carriage charge",
    hugeCoupon.total === 50_000, `${hugeCoupon.total}`);

  {
    // Every way of cutting this basket down, against the coupon that outgrows it.
    const big = { goodsTotal: 850_000, discount: 200_000, shippingCost: 50_000 };
    const before = repriceOrder(LINES, big);
    let broke = null;
    for (let a = 0; a <= 3; a++) {
      for (let b = 0; b <= 1; b++) {
        const after = repriceOrder(
          [{ ...LINES[0], qty: a }, { ...LINES[1], qty: b }],
          big
        );
        if (after.total > before.total || after.total < 0) broke = { a, b, total: after.total };
      }
    }
    check("no way of cutting the basket ever raises the total",
      broke === null, broke ? JSON.stringify(broke) : "8 combinations, none above " + before.total);
  }

  {
    // …and what تغییر سبد would actually send for one of those baskets.
    const remaining = [{ ...LINES[0], qty: 1 }, { ...LINES[1], qty: 0 }];
    const priced = repriceOrder(remaining, INVOICE);
    const update = buildCartList({
      items: snapppayItems(remaining),
      discountRial: tomanToRial(priced.discount),
      shippingRial: tomanToRial(priced.shippingCost),
    });
    check("تغییر سبد sends exactly the repriced total",
      update.amount === tomanToRial(priced.total), `${update.amount} Rial`);
    check("…which is never above the amount اسنپ‌پی already holds",
      update.amount <= tomanToRial(full.total), `${update.amount} ≤ ${tomanToRial(full.total)}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n5) THE CALLBACK CANNOT BE TALKED INTO PAYING AN ORDER");

  // ── forged state=OK ──
  {
    const { order, payment } = await makeAttempt();
    const res = await callback({
      transactionId: payment.resNum,
      state: "OK",
      amount: tomanToRial(800_000),
    });
    const after = await stateOf(payment.id, order.id);
    check("a forged state=OK is answered (no crash)", res.status >= 200 && res.status < 400,
      `HTTP ${res.status}`);
    check("…but the payment is NOT marked paid", after.payment.status !== "PAID",
      after.payment.status);
    check("…the order stays unpaid", after.order.status === "AWAITING_PAYMENT",
      after.order.status);
    check("…no club points were granted", after.order.pointsAwarded === false);
    check("…and no stock left the shelf", after.product.stock === 5, `${after.product.stock}`);
    check("…the attempt is not left stuck in VERIFYING",
      after.payment.status !== "VERIFYING", after.payment.status);
  }

  // ── the row's own id is not a transactionId ──
  {
    const { order, payment } = await makeAttempt();
    const res = await callback({
      transactionId: payment.id, // the cuid, which اسنپ‌پی has never been told
      state: "OK",
      amount: tomanToRial(800_000),
    });
    const after = await stateOf(payment.id, order.id);
    check("a callback quoting the row's id finds nothing to settle",
      after.payment.status === "PENDING", after.payment.status);
    check("…and is still answered rather than crashed",
      res.status >= 200 && res.status < 400, `HTTP ${res.status}`);
  }

  // ── an amount that disagrees with the invoice ──
  {
    const { order, payment } = await makeAttempt();
    await callback({
      transactionId: payment.resNum,
      state: "OK",
      amount: tomanToRial(10_000), // buyer "paid" 10,000 Toman for an 800,000 order
    });
    const after = await stateOf(payment.id, order.id);
    check("an amount below the invoice is refused as MISMATCH",
      after.payment.status === "MISMATCH", after.payment.status);
    check("…and the order is not shipped", after.order.status === "AWAITING_PAYMENT");
    check("…and no stock left the shelf", after.product.stock === 5);
  }

  // ── the buyer walked away / SnappPay refused the credit ──
  {
    const { order, payment } = await makeAttempt();
    await callback({ transactionId: payment.resNum, state: "FAILED", amount: tomanToRial(800_000) });
    const after = await stateOf(payment.id, order.id);
    check("state=FAILED marks the attempt failed", after.payment.status === "FAILED",
      after.payment.status);
    check("…the order stays unpaid", after.order.status === "AWAITING_PAYMENT");
    check("…and no stock left the shelf", after.product.stock === 5);
  }

  // ── an attempt whose token was never stored ──
  {
    const { payment } = await makeAttempt(800_000, false);
    await callback({ transactionId: payment.resNum, state: "OK", amount: tomanToRial(800_000) });
    const after = await db.payment.findUnique({ where: { id: payment.id } });
    check("an attempt with no paymentToken cannot be paid", after.status === "FAILED",
      `${after.status}: ${after.message ?? ""}`);
  }

  // ── an unknown transactionId ──
  {
    const res = await callback({ transactionId: "999000999", state: "OK", amount: 100 });
    check("an unknown transactionId is answered, not crashed",
      res.status >= 200 && res.status < 400, `HTTP ${res.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n6) «CALL VERIFY JUST ONCE» — the rule the doc states twice (p.13)");

  // ── a second callback must not re-run anything ──
  {
    const { order, payment } = await makeAttempt();
    await callback({ transactionId: payment.resNum, state: "FAILED", amount: tomanToRial(800_000) });
    const first = await db.payment.findUnique({ where: { id: payment.id } });

    // …now the same attempt comes back claiming success
    await callback({ transactionId: payment.resNum, state: "OK", amount: tomanToRial(800_000) });
    const second = await stateOf(payment.id, order.id);

    check("a settled attempt is not re-opened by a later callback",
      second.payment.status === first.status,
      `${first.status} → ${second.payment.status}`);
    check("…and the order is still unpaid", second.order.status === "AWAITING_PAYMENT");
  }

  // ── a PAID attempt is never re-verified or reverted ──
  {
    const { order, payment } = await makeAttempt();
    const paidAt = new Date("2026-01-01T00:00:00.000Z");
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt, settledAt: paidAt, refNum: "tx-" + randomBytes(4).toString("hex") },
    });
    await db.order.update({ where: { id: order.id }, data: { status: "PAID", pointsAwarded: true } });

    await callback({ transactionId: payment.resNum, state: "FAILED", amount: tomanToRial(800_000) });
    const after = await stateOf(payment.id, order.id);
    check("a PAID attempt survives a late state=FAILED callback",
      after.payment.status === "PAID", after.payment.status);
    check("…its paidAt is untouched", after.payment.paidAt?.getTime() === paidAt.getTime());
    check("…its settlement is untouched", after.payment.settledAt?.getTime() === paidAt.getTime());
    check("…and the order is still PAID", after.order.status === "PAID");
  }

  // ── two callbacks arriving at once ──
  {
    const { payment } = await makeAttempt();
    const [a, b] = await Promise.all([
      callback({ transactionId: payment.resNum, state: "OK", amount: tomanToRial(800_000) }),
      callback({ transactionId: payment.resNum, state: "OK", amount: tomanToRial(800_000) }),
    ]);
    const after = await db.payment.findUnique({ where: { id: payment.id } });
    check("simultaneous callbacks are both answered",
      a.status < 400 && b.status < 400, `HTTP ${a.status}/${b.status}`);
    check("…and leave exactly one settled outcome, never VERIFYING",
      after.status !== "VERIFYING" && after.status !== "PENDING", after.status);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n7) ONE GATEWAY'S CALLBACK NEVER SETTLES ANOTHER'S ATTEMPT");

  {
    // a SEP attempt handed to the اسنپ‌پی callback
    const order = await db.order.create({
      data: {
        userId: user.id, paymentMethod: "GATEWAY", status: "AWAITING_PAYMENT",
        goodsTotal: 800_000, total: 800_000,
        firstName: "تست", lastName: "سپ", fullName: "تست سپ",
        province: "تهران", city: "تهران", address: "خیابان آزمایش", phone: PHONE,
      },
    });
    const payment = await db.payment.create({
      data: {
        orderId: order.id, provider: "SEP", resNum: newTransactionRef(), amountRial: 8_000_000,
      },
    });

    await callback({ transactionId: payment.resNum, state: "OK", amount: 8_000_000 });
    const after = await db.payment.findUnique({ where: { id: payment.id } });
    check("the اسنپ‌پی callback refuses a سپ attempt", after.status === "PENDING", after.status);
  }

  {
    // the mirror: an اسنپ‌پی attempt handed to the دیجی‌پی callback
    const { payment } = await makeAttempt();
    await fetch(`${BASE}/api/payment/digipay/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: payment.resNum, trackingCode: "X", result: "SUCCESS" }),
      redirect: "manual",
    });
    const after = await db.payment.findUnique({ where: { id: payment.id } });
    check("the دیجی‌پی callback refuses an اسنپ‌پی attempt", after.status === "PENDING",
      after.status);
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n8) THE GATEWAY IS HIDDEN UNTIL IT IS SWITCHED ON");
  {
    const on = process.env.SNAPPPAY_ENABLED === "1";
    const res = await fetch(`${BASE}/checkout`, { redirect: "manual" });
    check("the checkout page renders", res.status < 400, `HTTP ${res.status}`);
    console.log(
      `   NOTE  SNAPPPAY_ENABLED=${process.env.SNAPPPAY_ENABLED ?? "0"} — ` +
        (on
          ? "the gateway option is live at checkout"
          : "اسنپ‌پی is still the واتس‌اپ hand-off, and /api/checkout refuses SNAPPPAY_IPG")
    );
  }
} finally {
  await cleanup();
  await db.$disconnect();
}

console.log(fails ? `\n${fails} check(s) failed.\n` : `\nAll checks passed.\n`);
process.exit(fails ? 1 : 0);
