/** Verifies discount codes and shipping methods end to end. */
import { PrismaClient } from "@prisma/client";
import { signIn } from "./testlogin.mjs";

const db = new PrismaClient();
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
const PHONE = "09123334444";
let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

// clean slate
await db.order.deleteMany({ where: { user: { phone: PHONE } } });
await db.user.deleteMany({ where: { phone: PHONE } });
await db.coupon.deleteMany({ where: { code: { startsWith: "T-" } } });

const user = await db.user.create({ data: { phone: PHONE, name: "تست کوپن" } });
// A cart line is product + size now, so the fixture has to carry one.
const product = await db.product.findFirst({
  where: {
    active: true,
    stock: { gte: 3 },
    OR: [
      { sizes: { none: {} } },
      { sizes: { some: { active: true, kind: { not: "CUSTOM" }, stock: { gte: 3 } } } },
    ],
  },
  include: {
    sizes: {
      where: { active: true, kind: { not: "CUSTOM" }, stock: { gte: 3 } },
      orderBy: { sort: "asc" },
    },
  },
});
const size = product.sizes[0] ?? null;
const cart = [{ id: product.id, qty: 1, sizeId: size?.id ?? null }];

// log in as this user to get a session cookie
// log in through the shared helper - it seeds the code row and then goes through
// the real /api/auth/otp/verify, on a per-run address so a repeat run of the
// suite is not thrown out by the auth guards
const session = await signIn(db, BASE, PHONE);
const cookie = session.cookie;

// A fresh address per RUN, so the 30-per-10-minutes guard on /api/coupon never
// throttles a repeat run of this suite. Within a run the bucket is shared, so
// the guard is still doing its job - section 9 proves it on an address of its own.
const RUN_IP = "203.0." + (1 + Math.floor(Math.random() * 250)) + "." + (1 + Math.floor(Math.random() * 250));
const GUESS_IP = "198.51." + (1 + Math.floor(Math.random() * 250)) + "." + (1 + Math.floor(Math.random() * 250));

// Each helper gets its own X-Real-Ip so the 30-per-10-minutes guard on
// /api/coupon does not throttle a re-run of this suite - and a throttled
// reply is raised rather than counted as a legitimate refusal, which would
// let a "rejected" check pass for entirely the wrong reason.
const tryCoupon = async (code) => {
  const r = await fetch(`${BASE}/api/coupon`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-Real-Ip": RUN_IP },
    body: JSON.stringify({ code, items: cart }),
  });
  if (r.status === 429) throw new Error("rate-limited — give this helper its own X-Real-Ip");
  return r.json();
};

// the money lives on the size row once a product has sizes
const price = size ? (size.salePrice ?? size.price) : (product.salePrice ?? product.price);

console.log("\n1) PERCENT CODE");
await db.coupon.create({ data: { code: "T-P20", type: "PERCENT", value: 20, active: true } });
const p20 = await tryCoupon("T-P20");
check("20% code accepted", p20.ok === true, JSON.stringify(p20.discount));
check("discount is 20% of cart", p20.discount === Math.floor(price * 0.2),
  `${p20.discount} vs ${Math.floor(price * 0.2)}`);
check("lowercase input still works", (await tryCoupon("t-p20")).ok === true);

console.log("\n2) FIXED AMOUNT + MINIMUM");
await db.coupon.create({
  data: { code: "T-F50", type: "FIXED", value: 50000, minSubtotal: 999999999, active: true },
});
const f50 = await tryCoupon("T-F50");
check("code below minimum is rejected", f50.ok === false, f50.error);

console.log("\n3) EXPIRY + INACTIVE");
await db.coupon.create({
  data: { code: "T-EXP", type: "PERCENT", value: 30, active: true, endsAt: new Date(Date.now() - 86400000) },
});
check("expired code rejected", (await tryCoupon("T-EXP")).ok === false);
await db.coupon.create({ data: { code: "T-OFF", type: "PERCENT", value: 30, active: false } });
check("disabled code rejected", (await tryCoupon("T-OFF")).ok === false);
check("unknown code rejected", (await tryCoupon("T-NOPE")).ok === false);

console.log("\n4) PERSONAL CODE");
const other = await db.user.upsert({
  where: { phone: "09125556666" }, update: {}, create: { phone: "09125556666" },
});
await db.coupon.create({
  data: { code: "T-MINE", type: "PERCENT", value: 40, active: true, userId: other.id },
});
check("someone else's personal code rejected", (await tryCoupon("T-MINE")).ok === false);
await db.coupon.update({ where: { code: "T-MINE" }, data: { userId: user.id } });
check("own personal code accepted", (await tryCoupon("T-MINE")).ok === true);

console.log("\n5) USAGE LIMIT");
await db.coupon.create({
  data: { code: "T-CAP", type: "PERCENT", value: 15, active: true, maxUses: 1, usedCount: 1 },
});
check("exhausted code rejected", (await tryCoupon("T-CAP")).ok === false);

console.log("\n6) CHECKOUT APPLIES THE DISCOUNT");
const res = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: cart, couponCode: "T-P20",
    firstName: "تست", lastName: "کوپن", phone: PHONE,
    province: "تهران", city: "تهران", address: "خیابان تست",
  }),
});
const data = await res.json();
check("order created with coupon", data.ok === true, JSON.stringify(data).slice(0, 120));
const order = await db.order.findUnique({ where: { id: data.orderId } });
check("discount stored on order", order.discount === Math.floor(price * 0.2), `${order.discount}`);
check("coupon code stored", order.couponCode === "T-P20");
check("goods total stored", order.goodsTotal === price, `${order.goodsTotal}`);
check("total = goods − discount + shipping",
  order.total === order.goodsTotal - order.discount + order.shippingCost,
  `${order.goodsTotal} − ${order.discount} + ${order.shippingCost} = ${order.total}`);
check("shipping method recorded", !!order.shippingName, order.shippingName ?? "");

console.log("\n7) FORGED DISCOUNT IS IGNORED");
const forged = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: cart, couponCode: "T-NOPE", discount: 9999999, total: 1,
    firstName: "تست", lastName: "کوپن", phone: PHONE,
    province: "تهران", city: "تهران", address: "خیابان تست",
  }),
});
check("invalid code blocks the order rather than silently discounting", forged.status === 400);

console.log("\n8) A CODE CAN BE BARRED FROM INSTALMENTS");

// two otherwise-identical codes: one allows instalments, one does not
await db.coupon.create({
  data: { code: "T-ANY", type: "PERCENT", value: 10, allowInstallments: true, perUserLimit: 0 },
});
await db.coupon.create({
  data: { code: "T-NOINST", type: "PERCENT", value: 10, allowInstallments: false, perUserLimit: 0 },
});

const withMethod = async (code, paymentMethod, ip = RUN_IP) => {
  const r = await fetch(`${BASE}/api/coupon`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-Real-Ip": ip },
    body: JSON.stringify({ code, items: cart, paymentMethod }),
  });
  const j = await r.json();
  // A throttled reply is also {ok:false}, which would let a "refused" check
  // pass for entirely the wrong reason. Surface it instead.
  if (r.status === 429) throw new Error("rate-limited — this test needs its own X-Real-Ip");
  return j;
};

check("default codes still work on دیجی‌پی", (await withMethod("T-ANY", "DIGIPAY")).ok === true);
check("default codes still work on the gateway", (await withMethod("T-ANY", "GATEWAY")).ok === true);
check("a barred code still works on the gateway", (await withMethod("T-NOINST", "GATEWAY")).ok === true);
check("a barred code still works on کارت به کارت", (await withMethod("T-NOINST", "CARD")).ok === true,
  "کارت به کارت is paid in full, so it is not an instalment");

const onDigipay = await withMethod("T-NOINST", "DIGIPAY");
check("a barred code is refused on دیجی‌پی", onDigipay.ok === false,
  JSON.stringify(onDigipay).slice(0, 80));
check("…with a message that explains why", /قسط/.test(onDigipay.error ?? ""),
  (onDigipay.error ?? "").slice(0, 50));
check("a barred code is refused on اسنپ‌پی", (await withMethod("T-NOINST", "SNAPPPAY")).ok === false);
check("no method named ⇒ still validates (the preview before a choice)",
  (await withMethod("T-NOINST", null)).ok === true);

// the checkout is the authority: the browser may claim anything
const sneaky = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: cart, couponCode: "T-NOINST", paymentMethod: "DIGIPAY",
    firstName: "تست", lastName: "کوپن", phone: PHONE,
    province: "تهران", city: "تهران", address: "خیابان تست",
  }),
});
const sneakyJson = await sneaky.json();
check("checkout refuses a barred code paid by دیجی‌پی", sneaky.status === 400 && sneakyJson.ok === false,
  `HTTP ${sneaky.status}`);
const leaked = await db.order.count({ where: { userId: user.id, couponCode: "T-NOINST" } });
check("…and no order slipped through", leaked === 0, String(leaked));

// and the same code on an allowed method still buys
const allowed = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: cart, couponCode: "T-NOINST", paymentMethod: "GATEWAY",
    firstName: "تست", lastName: "کوپن", phone: PHONE,
    province: "تهران", city: "تهران", address: "خیابان تست",
  }),
});
const allowedJson = await allowed.json();
check("the same code goes through on the gateway", allowedJson.ok === true,
  JSON.stringify(allowedJson).slice(0, 90));

console.log("");
console.log("9) THE CODE-GUESSING LIMIT STILL BITES");
let throttled = false;
for (let i = 0; i < 34; i++) {
  const r = await fetch(`${BASE}/api/coupon`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-Ip": GUESS_IP },
    body: JSON.stringify({ code: "T-GUESS" + i, items: cart }),
  });
  if (r.status === 429) { throttled = true; break; }
}
check("bulk code guessing gets rate-limited", throttled,
  "30 tries per 10 minutes per IP");


// cleanup
await db.order.deleteMany({ where: { userId: user.id } });
await db.coupon.deleteMany({ where: { code: { startsWith: "T-" } } });
await db.user.deleteMany({ where: { phone: { in: [PHONE, "09125556666"] } } });
await db.otp.deleteMany({ where: { phone: PHONE } });

console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
await db.$disconnect();
process.exit(fails === 0 ? 0 : 1);
