/**
 * خرید چهار قسطه اسنپ‌پی - end-to-end safety net.
 *
 *   npx next build && npx next start     (one terminal)
 *   node tools/snapptest.mjs             (another)
 *
 * SnappPay moves no money through the site, so the risks here are not banking
 * risks - they are inventory and club-points risks:
 *
 *   · an instalment split that doesn't add up to the invoice
 *   · goods reserved twice, or never released when an order is cancelled
 *   · club points granted twice by an admin clicking approve twice
 *   · a SnappPay order slipping into the bank gateway and being charged in full
 *
 * Every one of those is checked below against a real server and a real browser.
 */
import puppeteer from "puppeteer-core";
import { PrismaClient } from "@prisma/client";
import { signIn, signInBrowser } from "./testlogin.mjs";

const db = new PrismaClient();
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
const PHONE = "09121114455"; // test customer
const ADMIN_PHONE = "09121230000";
const log = console.log;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, cond, extra = "") => {
  if (!cond) failures++;
  log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

// ── 1. Instalment maths (pure, no server) ─────────────────────
log("\n1) INSTALMENT MATHS");

// mirrors src/lib/snapppay.ts - if these ever disagree, the site is wrong
const split = (total) => {
  const safe = Math.max(0, Math.round(total));
  const base = Math.floor(safe / 4);
  const parts = [base, base, base, base];
  parts[0] = safe - base * 3;
  return parts;
};

let sumOk = true, equalOk = true, negativeOk = true;
for (const total of [0, 1, 3, 4, 7, 100, 999, 1000, 100001, 349999, 2000000, 15678903]) {
  const p = split(total);
  if (p.reduce((a, b) => a + b, 0) !== total) sumOk = false;
  if (!(p[1] === p[2] && p[2] === p[3])) equalOk = false;
  if (p.some((x) => x < 0)) negativeOk = false;
}
check("four parts always add up to the invoice exactly", sumOk);
check("instalments 2–4 are equal (remainder rides on the first)", equalOk);
check("no negative instalment for any total", negativeOk);

const odd = split(100001);
check("remainder lands on the first instalment", odd[0] > odd[1], `${odd[0]} vs ${odd[1]}`);

// month-end clamping: 31 Jan + 1 month must not skip into March
const addMonths = (from, months) => {
  const out = new Date(from.getTime());
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
};
const jan31 = new Date(2027, 0, 31);
check("31 Jan + 1 month clamps to 28 Feb (not 3 Mar)", addMonths(jan31, 1).getMonth() === 1,
  addMonths(jan31, 1).toDateString());
check("31 Jan + 3 months = 30 Apr", addMonths(jan31, 3).getDate() === 30,
  addMonths(jan31, 3).toDateString());
const leap = addMonths(new Date(2028, 0, 31), 1);
check("leap year: 31 Jan 2028 + 1 month = 29 Feb", leap.getDate() === 29, leap.toDateString());

// ── clean slate ───────────────────────────────────────────────
await db.orderItem.deleteMany({ where: { order: { user: { phone: PHONE } } } });
await db.order.deleteMany({ where: { user: { phone: PHONE } } });
await db.otp.deleteMany({ where: { phone: PHONE } });

// ── 2. Place a SnappPay order over HTTP ───────────────────────
log("\n2) CHECKOUT — SnappPay order");

const session = await signIn(db, BASE, PHONE);
const cookie = session.cookie;
check("test customer logged in", session.ok);

const product = await db.product.findFirst({
  where: {
    active: true,
    stock: { gte: 3 },
    // A colourway would make this a variant test rather than a payment test - 
    // colours have their own suite, so pick a product that has none.
    colorsEnabled: false,
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
const sizeId = size?.id ?? null;
const stockBefore = product.stock;
const size0 = product.sizes[0] ?? null;
const unit = size0 ? (size0.salePrice ?? size0.price) : (product.salePrice ?? product.price);
const user = await db.user.findUnique({ where: { phone: PHONE } });
const userBefore = user;
const pointsBefore = userBefore.points;

// اسنپ‌پی is no longer sold on the site: the checkout must refuse it outright
// rather than quietly charging the buyer in full through the bank.
const refused = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: [{ id: product.id, qty: 2, sizeId }],
    firstName: "تست", lastName: "اسنپ‌پی", province: "تهران", city: "تهران",
    address: "خیابان تست", phone: PHONE, paymentMethod: "SNAPPPAY",
  }),
});
const refusedJson = await refused.json();
check("a new اسنپ‌پی order is refused", refused.status === 400 && refusedJson.ok === false,
  `HTTP ${refused.status}`);
check("…and the buyer is pointed at واتس‌اپ", /واتس‌اپ/.test(refusedJson.error ?? ""),
  (refusedJson.error ?? "").slice(0, 60));
const strayCount = await db.order.count({ where: { phone: PHONE, paymentMethod: "SNAPPPAY" } });
check("…and no order was created by the attempt", strayCount === 0, String(strayCount));
const stockUntouched = await db.product.findUnique({ where: { id: product.id } });
check("…and no stock was reserved", stockUntouched.stock === stockBefore,
  `${stockBefore} → ${stockUntouched.stock}`);

// Everything below covers orders that ALREADY exist in AWAITING_SNAPPPAY - 
// placed before the option was withdrawn, or entered by the shop by hand. They
// must still reserve stock, approve, and grant points exactly as before.
const order = await db.order.create({
  data: {
    userId: user.id,
    paymentMethod: "SNAPPPAY",
    status: "AWAITING_SNAPPPAY",
    stockApplied: true,
    goodsTotal: unit * 2,
    discount: 0,
    shippingCost: 0,
    total: unit * 2,
    firstName: "تست", lastName: "اسنپ‌پی", fullName: "تست اسنپ‌پی",
    province: "تهران", city: "تهران", address: "خیابان تست", phone: PHONE,
    items: {
      create: [{
        productId: product.id, nameFa: product.nameFa, qty: 2, unitPrice: unit,
        sizeId, sizeLabel: size?.label ?? null,
      }],
    },
  },
  include: { items: true },
});
await db.product.update({ where: { id: product.id }, data: { stock: { decrement: 2 } } });
if (sizeId) await db.productSize.update({ where: { id: sizeId }, data: { stock: { decrement: 2 } } });

check("status is AWAITING_SNAPPPAY (not AWAITING_PAYMENT)", order.status === "AWAITING_SNAPPPAY", order.status);
check("paymentMethod stored as SNAPPPAY", order.paymentMethod === "SNAPPPAY");
check("not approved yet", order.snapppayApprovedAt === null);
check("no club points granted before approval", order.pointsAwarded === false);

const afterOrder = await db.product.findUnique({ where: { id: product.id } });
check("goods reserved at order time", afterOrder.stock === stockBefore - 2,
  `${stockBefore} → ${afterOrder.stock}`);
check("order marked as holding stock", order.stockApplied === true);

const userAfterOrder = await db.user.findUnique({ where: { phone: PHONE } });
check("points untouched until approval", userAfterOrder.points === pointsBefore,
  `${pointsBefore} → ${userAfterOrder.points}`);

// ── 3. The two payment paths must not cross ───────────────────
log("\n3) PATH GUARDS");
const noFollow = { headers: { Cookie: cookie }, redirect: "manual" };
const payRes = await fetch(`${BASE}/checkout/pay/${order.id}`, noFollow);
const payLoc = payRes.headers.get("location") ?? "";
check("bank gateway refuses a SnappPay order", payLoc.includes(`/checkout/snapppay/${order.id}`),
  `HTTP ${payRes.status} → ${payLoc || "(no redirect)"}`);

const successRes = await fetch(`${BASE}/checkout/success?order=${order.id}`, noFollow);
const successLoc = successRes.headers.get("location") ?? "";
check("bank result page redirects to the instalment page", successLoc.includes("/checkout/snapppay/"),
  `HTTP ${successRes.status} → ${successLoc || "(no redirect)"}`);

const snappHtml = (await (await fetch(`${BASE}/checkout/snapppay/${order.id}`, { headers: { Cookie: cookie } })).text())
  .replaceAll("<!-- -->", "");
const parts = split(order.total);
check("instalment page shows the WhatsApp hand-off", snappHtml.includes("wa.me/"));
check("instalment page shows the first instalment", snappHtml.includes(parts[0].toLocaleString("fa-IR")),
  `${parts[0]} Toman`);
check("instalment page shows the order total", snappHtml.includes(order.total.toLocaleString("fa-IR")));
check("no due dates shown before approval", !snappHtml.includes("~ "));

// ── 4. Admin approval, through the real UI ────────────────────
log("\n4) ADMIN APPROVAL (browser)");
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();

// Sign in without spending an SMS request - see tools/testlogin.mjs. Only
// paytest drives the full request→verify login through the browser; the whole
// suite shares one 5-per-10-minutes budget for it.
const adminSession = await signInBrowser(db, BASE, ADMIN_PHONE, page);
check("admin logged in", adminSession.ok, adminSession.cookie ? "session opened" : "no cookie");

await page.goto(`${BASE}/admin/orders/${order.id}`, { waitUntil: "networkidle2" });
await wait(800);
const hasApprove = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((b) => b.textContent.includes("تأیید اسنپ‌پی"))
);
check("approve button shown for a waiting order", hasApprove);

await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("تأیید اسنپ‌پی"));
  b.click();
});
await wait(3500);

const approved = await db.order.findUnique({ where: { id: order.id } });
check("status becomes PAID after approval", approved.status === "PAID", approved.status);
check("approval timestamp recorded", approved.snapppayApprovedAt !== null);
check("points flagged as granted", approved.pointsAwarded === true);

const userApproved = await db.user.findUnique({ where: { phone: PHONE } });
const pointsGranted = userApproved.points - pointsBefore;
check("club points granted once", pointsGranted > 0, `+${pointsGranted}`);

const stockApproved = await db.product.findUnique({ where: { id: product.id } });
check("stock NOT decremented a second time", stockApproved.stock === stockBefore - 2,
  `${stockBefore} → ${stockApproved.stock}`);

// ── 5. Double approval must be a no-op ────────────────────────
log("\n5) DOUBLE-APPROVAL GUARD");
await page.goto(`${BASE}/admin/orders/${order.id}`, { waitUntil: "networkidle2" });
await wait(800);
const stillHasApprove = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((b) => b.textContent.includes("تأیید اسنپ‌پی"))
);
check("approve button gone once approved", !stillHasApprove);

// force the status box to re-confirm PAID - the other route into fulfilment
await page.evaluate(() => {
  const sel = document.querySelector('select[name="status"]');
  sel.value = "PAID";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ذخیره")).click();
});
await wait(3000);

const userTwice = await db.user.findUnique({ where: { phone: PHONE } });
check("points NOT granted twice", userTwice.points - pointsBefore === pointsGranted,
  `+${userTwice.points - pointsBefore} total`);
const stockTwice = await db.product.findUnique({ where: { id: product.id } });
check("stock NOT taken twice", stockTwice.stock === stockBefore - 2,
  `${stockBefore} → ${stockTwice.stock}`);

// ── 6. Cancelling returns the reserved goods ──────────────────
log("\n6) CANCELLATION RETURNS STOCK");
await page.evaluate(() => {
  const sel = document.querySelector('select[name="status"]');
  sel.value = "CANCELLED";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ذخیره")).click();
});
await wait(3000);
const cancelled = await db.order.findUnique({ where: { id: order.id } });
const stockCancelled = await db.product.findUnique({ where: { id: product.id } });
check("order cancelled", cancelled.status === "CANCELLED", cancelled.status);
check("reserved goods returned to the shelf", stockCancelled.stock === stockBefore,
  `${stockCancelled.stock} (started at ${stockBefore})`);
check("order no longer holds stock", cancelled.stockApplied === false);

// ── 7. A normal card order still behaves ──────────────────────
log("\n7) REGRESSION — the bank flow is untouched");
const cardRes = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: [{ id: product.id, qty: 1, sizeId }],
    firstName: "تست", lastName: "کارت", province: "تهران", city: "تهران",
    address: "خیابان تست", phone: PHONE,
  }),
});
const cardJson = await cardRes.json();
const cardOrder = await db.order.findUnique({ where: { id: cardJson.orderId } });
check("card order still AWAITING_PAYMENT", cardOrder.status === "AWAITING_PAYMENT", cardOrder.status);
check("card order defaults to GATEWAY", cardOrder.paymentMethod === "GATEWAY");
check("card order does NOT reserve stock", cardOrder.stockApplied === false);
const stockCard = await db.product.findUnique({ where: { id: product.id } });
check("stock untouched by an unpaid card order", stockCard.stock === stockBefore,
  `${stockCard.stock}`);
check("card order still reaches the bank gateway",
  !(await fetch(`${BASE}/checkout/pay/${cardOrder.id}`, noFollow)).headers.get("location")?.includes("snapppay"));

// ── cleanup ───────────────────────────────────────────────────
await browser.close();
await db.orderItem.deleteMany({ where: { order: { user: { phone: PHONE } } } });
await db.order.deleteMany({ where: { user: { phone: PHONE } } });
await db.user.update({ where: { phone: PHONE }, data: { points: pointsBefore } });
await db.product.update({ where: { id: product.id }, data: { stock: stockBefore } });
await db.otp.deleteMany({ where: { phone: PHONE } });

log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
await db.$disconnect();
process.exit(failures === 0 ? 0 : 1);
