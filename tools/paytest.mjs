import puppeteer from "puppeteer-core";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PHONE = "09121112233";
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
const log = console.log;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, cond, extra = "") => {
  if (!cond) failures++;
  log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
// A fresh address per run: /api/auth/otp/request allows 5 tries per 10 minutes
// per IP, so without this a repeat run of the suite fails on the login step for
// reasons that have nothing to do with what is being tested.
await page.setExtraHTTPHeaders({
  "X-Real-Ip": "203.0." + (1 + Math.floor(Math.random() * 250)) + "." + (1 + Math.floor(Math.random() * 250)),
});
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message));

await db.payment.deleteMany({ where: { order: { user: { phone: PHONE } } } });
await db.orderItem.deleteMany({ where: { order: { user: { phone: PHONE } } } });
await db.order.deleteMany({ where: { user: { phone: PHONE } } });
await db.user.deleteMany({ where: { phone: PHONE } });
await db.otp.deleteMany({ where: { phone: PHONE } });

// ── 1. OTP login ──────────────────────────────────────────────
log("\n1) OTP LOGIN");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await wait(1500); // let React hydrate, else typing never reaches component state
await page.type('input[inputmode="tel"]', PHONE);
await wait(400);
const btnState = await page.evaluate(() => {
  const b = document.querySelector("form button");
  return { disabled: b?.disabled, text: b?.textContent?.trim() };
});
check("submit button enabled after typing phone", btnState.disabled === false, JSON.stringify(btnState));
await page.click("form button");
await wait(3000);
const otp = await db.otp.findFirst({ where: { phone: PHONE }, orderBy: { createdAt: "desc" } });
check("OTP row created in DB", !!otp, otp ? `code=${otp.code}` : "");
await page.type(".otp-box", otp.code);
await wait(300);
// NB: the first button in this form is "ویرایش شماره" - must click the submit one
await page.evaluate(() => {
  [...document.querySelectorAll("form button")]
    .find((b) => b.type === "submit" || b.textContent.trim() === "ورود")
    .click();
});
await wait(3500);
const user = await db.user.findUnique({ where: { phone: PHONE } });
check("user created on first login", !!user);
check("welcome points granted", user?.points === 50, `points=${user?.points}`);
check("logged in (left /login)", !page.url().includes("/login"), page.url());

// ── 2. cart + checkout ────────────────────────────────────────
log("\n2) CART + CHECKOUT");
// Resolve a real product rather than hardcoding a slug - the shop's catalogue
// is re-imported from time to time and the slugs move with it.
const buyable = await db.product.findFirst({
  // A colourway would make this a variant test rather than a payment test - 
  // colours have their own suite, so pick a product that has none.
  where: { active: true, stock: { gte: 2 }, colorsEnabled: false },
  orderBy: { createdAt: "asc" },
});
check("test fixture: a product in stock exists", !!buyable, buyable?.slug);
await page.goto(`${BASE}/products/${buyable.slug}`, { waitUntil: "networkidle2" });
await wait(800);
// products with more than one size need one chosen before the button works
await page.evaluate(() => {
  const pick = document.querySelector(
    '[data-size-option][data-size-out="0"]:not([data-size-kind="CUSTOM"])'
  );
  if (pick) pick.click();
});
await wait(300);
const added = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("افزودن به سبد"));
  if (b) { b.click(); return true; }
  return false;
});
check("added to cart", added);
await wait(1200);

await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle2" });
await wait(1000);
// type for real so React state updates
const fillNth = async (n, value) => {
  const els = await page.$$("input.input");
  if (!els[n]) return false;
  await els[n].click({ clickCount: 3 });
  await els[n].type(value);
  return true;
};
const fill = async (fragment, value) => {
  for (const h of await page.$$("input.input, textarea.input")) {
    const ph = await h.evaluate((e) => e.placeholder || "");
    if (ph.includes(fragment)) {
      await h.click({ clickCount: 3 });
      await h.type(value);
      return true;
    }
  }
  return false;
};
// new billing form: first/last name, province select, city, street
check("filled first name", await fillNth(0, "تست"));
check("filled last name", await fillNth(1, "خریدار"));
check("selected province", await page.evaluate(() => {
  const sel = document.querySelector("select");
  if (!sel) return false;
  sel.value = "تهران";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return sel.value === "تهران";
}));
check("filled city", await fill("شهر", "تهران") || await fillNth(3, "تهران"));
check("filled address", await fill("نام خیابان و پلاک خانه", "خیابان آزمایشی، پلاک ۱"));
await wait(400);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => x.textContent.includes("ثبت سفارش")).click();
});
await wait(5000);

const order = await db.order.findFirst({
  where: { user: { phone: PHONE } }, orderBy: { createdAt: "desc" }, include: { payments: true, items: true },
});
check("order created", !!order, order ? `total=${order.total} items=${order.items.length}` : "");
const boughtId = order?.items[0]?.productId;
const stockBefore = (await db.product.findUnique({ where: { id: boughtId } })).stock;
check("shipping cost recorded on order", typeof order?.shippingCost === "number",
  `shipping=${order?.shippingCost} total=${order?.total}`);
check("order starts AWAITING_PAYMENT", order?.status === "AWAITING_PAYMENT");
check("no points awarded before payment", (await db.user.findUnique({ where: { phone: PHONE } })).points === 50);
check("payment attempt created", order?.payments.length === 1);
check("Toman→Rial conversion (×10)", order?.payments[0]?.amountRial === order?.total * 10,
  `${order?.total} Toman → ${order?.payments[0]?.amountRial} Rial`);

// ── 3. gateway + successful payment ───────────────────────────
log("\n3) GATEWAY + PAYMENT");
const onGateway = await page.evaluate(() => document.body.innerText.includes("درگاه پرداخت آزمایشی"));
check("reached gateway page", onGateway, page.url());
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => x.textContent.includes("پرداخت موفق")).click();
});
await wait(4000);
check("success page shown",
  await page.evaluate(() => document.body.innerText.includes("پرداخت با موفقیت انجام شد")), page.url());

const paid = await db.order.findUnique({ where: { id: order.id }, include: { payments: true } });
const userPaid = await db.user.findUnique({ where: { phone: PHONE } });
check("order marked PAID", paid.status === "PAID");
check("payment marked PAID", paid.payments[0].status === "PAID");
check("RefNum stored", !!paid.payments[0].refNum);
check("bank reference (RRN) stored", !!paid.payments[0].rrn);
const expected = 50 + Math.floor(order.total / 100000) * 10;
check("club points awarded on payment", userPaid.points === expected, `${userPaid.points} (expected ${expected})`);

const stockAfter = (await db.product.findUnique({ where: { id: boughtId } })).stock;
const soldQty = order.items[0].qty;
check("STOCK DECREMENTED on payment", stockAfter === stockBefore - soldQty,
  `${stockBefore} → ${stockAfter} (sold ${soldQty})`);

// ── 4. replay the same callback ───────────────────────────────
log("\n3b) STOCK: replay safety + oversell with a real session");
await fetch(`${BASE}/api/payment/callback`, {
  method: "POST", redirect: "manual",
  body: new URLSearchParams({ ResNum: paid.payments[0].resNum, RefNum: paid.payments[0].refNum, State: "OK", Status: "2" }),
});
check("stock NOT decremented twice by a replayed callback",
  (await db.product.findUnique({ where: { id: boughtId } })).stock === stockAfter);

const cookies = (await page.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
// A cart line is product + size now, so ask for more than that SIZE has - 
// a sizeless line would be refused on its own merits before stock is checked,
// which would pass this test for entirely the wrong reason.
const boughtSize = order.items[0].sizeId
  ? await db.productSize.findUnique({ where: { id: order.items[0].sizeId } })
  : null;
const oversellQty = (boughtSize ? boughtSize.stock : stockAfter) + 5;
const oversell = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookies },
  body: JSON.stringify({
    items: [{ id: boughtId, qty: oversellQty, sizeId: order.items[0].sizeId ?? null }],
    firstName: "تست", lastName: "خریدار", phone: PHONE, province: "تهران",
    city: "تهران", address: "خیابان تست، پلاک ۲",
  }),
});
const oversellBody = await oversell.json().catch(() => ({}));
check("logged-in oversell attempt rejected (409)", oversell.status === 409,
  `HTTP ${oversell.status} · ${oversellBody.error ?? ""}`);

log("\n4) SECURITY: callback replay");
await fetch(`${BASE}/api/payment/callback`, {
  method: "POST", redirect: "manual",
  body: new URLSearchParams({ ResNum: paid.payments[0].resNum, RefNum: paid.payments[0].refNum, State: "OK", Status: "2" }),
});
const afterReplay = await db.user.findUnique({ where: { phone: PHONE } });
check("points NOT granted twice", afterReplay.points === expected, `points=${afterReplay.points}`);

// ── 5. double-spend: reuse RefNum on another order ────────────
log("\n5) SECURITY: receipt reuse (double-spend)");
const o2 = await db.order.create({
  data: { userId: user.id, total: 500000, fullName: "x", firstName: "x", lastName: "y", phone: PHONE, province: "تهران", city: "تهران", address: "y" },
});
const p2 = await db.payment.create({ data: { orderId: o2.id, resNum: "TEST-RES-2", amountRial: 5000000 } });
await fetch(`${BASE}/api/payment/callback`, {
  method: "POST", redirect: "manual",
  body: new URLSearchParams({ ResNum: p2.resNum, RefNum: paid.payments[0].refNum, State: "OK", Status: "2" }),
});
const o2After = await db.order.findUnique({ where: { id: o2.id }, include: { payments: true } });
check("reused receipt rejected", o2After.status === "AWAITING_PAYMENT" && o2After.payments[0].status === "FAILED",
  o2After.payments[0].message ?? "");

// ── 6a. callback Amount field must be ignored ─────────────────
log("\n6) SECURITY: amount tampering");
const o3 = await db.order.create({
  data: { userId: user.id, total: 900000, fullName: "x", firstName: "x", lastName: "y", phone: PHONE, province: "تهران", city: "تهران", address: "y" },
});
const p3 = await db.payment.create({ data: { orderId: o3.id, resNum: "TEST-RES-3", amountRial: 9000000 } });
await fetch(`${BASE}/api/payment/callback`, {
  method: "POST", redirect: "manual",
  body: new URLSearchParams({ ResNum: p3.resNum, RefNum: "SBX-TAMPER-1", State: "OK", Status: "2", Amount: "10" }),
});
const o3After = await db.order.findUnique({ where: { id: o3.id }, include: { payments: true } });
check("attacker's Amount=10 in callback ignored; charged amount unchanged",
  o3After.payments[0].amountRial === 9000000,
  `stored=${o3After.payments[0].amountRial} Rial`);

// ── 6b. bank reports a different amount → must NOT fulfil ─────
const o5 = await db.order.create({
  data: { userId: user.id, total: 900000, fullName: "x", firstName: "x", lastName: "y", phone: PHONE, province: "تهران", city: "تهران", address: "y" },
});
const p5 = await db.payment.create({ data: { orderId: o5.id, resNum: "TEST-RES-5", amountRial: 9000000 } });
const pointsBeforeMismatch = (await db.user.findUnique({ where: { phone: PHONE } })).points;
await fetch(`${BASE}/api/payment/callback`, {
  method: "POST", redirect: "manual",
  body: new URLSearchParams({
    ResNum: p5.resNum, RefNum: "SBX-MISMATCH-1", State: "OK", Status: "2",
    VerifiedAmountRial: "10000", // bank says 1,000 Toman was paid, invoice is 900,000
  }),
});
const o5After = await db.order.findUnique({ where: { id: o5.id }, include: { payments: true } });
const pointsAfterMismatch = (await db.user.findUnique({ where: { phone: PHONE } })).points;
check("underpaid order NOT marked paid", o5After.status === "AWAITING_PAYMENT", `order=${o5After.status}`);
check("underpayment flagged MISMATCH for refund", o5After.payments[0].status === "MISMATCH",
  o5After.payments[0].message ?? "");
check("no points for underpayment", pointsAfterMismatch === pointsBeforeMismatch);

// ── 7. cancelled payment ──────────────────────────────────────
log("\n7) USER CANCELS");
const o4 = await db.order.create({
  data: { userId: user.id, total: 300000, fullName: "x", firstName: "x", lastName: "y", phone: PHONE, province: "تهران", city: "تهران", address: "y" },
});
const p4 = await db.payment.create({ data: { orderId: o4.id, resNum: "TEST-RES-4", amountRial: 3000000 } });
await fetch(`${BASE}/api/payment/callback`, {
  method: "POST", redirect: "manual",
  body: new URLSearchParams({ ResNum: p4.resNum, State: "CanceledByUser", Status: "1" }),
});
const o4After = await db.order.findUnique({ where: { id: o4.id }, include: { payments: true } });
check("cancel leaves order unpaid + retryable", o4After.status === "AWAITING_PAYMENT" && o4After.payments[0].status === "CANCELLED",
  o4After.payments[0].message ?? "");

log(`\nJS errors on pages: ${jsErrors.length}`);
jsErrors.forEach((e) => log("   " + e.slice(0, 160)));
log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);

await browser.close();
await db.$disconnect();
process.exit(failures === 0 ? 0 : 1);
