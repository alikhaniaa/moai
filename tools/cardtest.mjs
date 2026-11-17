/**
 * کارت به کارت - end-to-end safety net.
 *
 *   npx next build && npx next start     (one terminal)
 *   node tools/cardtest.mjs              (another)
 *
 * A card transfer settles outside the site entirely, so the risks are the same
 * ones the SnappPay flow has (see tools/snapptest.mjs):
 *
 *   · goods reserved twice, or never released when an order is cancelled
 *   · club points granted twice by an admin confirming twice
 *   · a card order slipping into the bank gateway and being charged again
 *   · the card number shown to the buyer not matching تنظیمات
 */
import puppeteer from "puppeteer-core";
import { PrismaClient } from "@prisma/client";
import { signIn, signInBrowser } from "./testlogin.mjs";

const db = new PrismaClient();
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
const PHONE = "09121117788"; // test customer
const ADMIN_PHONE = "09121230000";
const log = console.log;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, cond, extra = "") => {
  if (!cond) failures++;
  log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

await db.orderItem.deleteMany({ where: { order: { user: { phone: PHONE } } } });
await db.order.deleteMany({ where: { user: { phone: PHONE } } });
await db.otp.deleteMany({ where: { phone: PHONE } });

// ── 1. Place a card-transfer order ────────────────────────────
log("\n1) CHECKOUT — کارت به کارت order");

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
const pointsBefore = (await db.user.findUnique({ where: { phone: PHONE } })).points;

const orderRes = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    items: [{ id: product.id, qty: 2, sizeId }],
    firstName: "تست", lastName: "کارتی", province: "تهران", city: "تهران",
    address: "خیابان تست", phone: PHONE, paymentMethod: "CARD",
  }),
});
const orderJson = await orderRes.json();
check("order accepted", orderJson.ok === true, JSON.stringify(orderJson).slice(0, 140));
check("server routes buyer to the transfer page", (orderJson.next ?? "").includes("/checkout/transfer/"),
  orderJson.next);

const order = await db.order.findUnique({ where: { id: orderJson.orderId } });
check("status is AWAITING_TRANSFER", order.status === "AWAITING_TRANSFER", order.status);
check("paymentMethod stored as CARD", order.paymentMethod === "CARD");
check("no instalment date set (card has no schedule)", order.snapppayApprovedAt === null);
check("no club points before approval", order.pointsAwarded === false);

const afterOrder = await db.product.findUnique({ where: { id: product.id } });
check("goods reserved at order time", afterOrder.stock === stockBefore - 2,
  `${stockBefore} → ${afterOrder.stock}`);

// ── 2. The card details shown must come from تنظیمات ──────────
log("\n2) CARD DETAILS COME FROM SETTINGS");
const html = (await (await fetch(`${BASE}/checkout/transfer/${order.id}`, { headers: { Cookie: cookie } })).text())
  .replaceAll("<!-- -->", "");

const settings = Object.fromEntries((await db.setting.findMany()).map((s) => [s.key, s.value]));
const cardNumber = settings.cardNumber ?? "6219860000000000";
const cardHolder = settings.cardHolder ?? "نام صاحب حساب";
const grouped = cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ");
check("card number rendered, grouped in fours", html.includes(grouped), grouped);
check("card holder name rendered", html.includes(cardHolder), cardHolder);
check("exact amount shown", html.includes(order.total.toLocaleString("fa-IR")));
check("WhatsApp receipt hand-off present", html.includes("wa.me/"));

// change the setting → the page must follow it, not a hardcoded constant
await db.setting.upsert({
  where: { key: "cardHolder" },
  update: { value: "TEST-HOLDER-XYZ" },
  create: { key: "cardHolder", value: "TEST-HOLDER-XYZ" },
});
const html2 = await (await fetch(`${BASE}/checkout/transfer/${order.id}`, { headers: { Cookie: cookie } })).text();
check("editing تنظیمات changes the page (not hardcoded)", html2.includes("TEST-HOLDER-XYZ"));
await db.setting.upsert({
  where: { key: "cardHolder" },
  update: { value: cardHolder },
  create: { key: "cardHolder", value: cardHolder },
});

// ── 3. Path guards ────────────────────────────────────────────
log("\n3) PATH GUARDS");
const noFollow = { headers: { Cookie: cookie }, redirect: "manual" };
const payLoc = (await fetch(`${BASE}/checkout/pay/${order.id}`, noFollow)).headers.get("location") ?? "";
check("bank gateway refuses a card-transfer order", payLoc.includes(`/checkout/transfer/${order.id}`),
  payLoc || "(no redirect)");
const successLoc = (await fetch(`${BASE}/checkout/success?order=${order.id}`, noFollow)).headers.get("location") ?? "";
check("bank result page redirects to the transfer page", successLoc.includes("/checkout/transfer/"),
  successLoc || "(no redirect)");

// ── 4. Admin approval ─────────────────────────────────────────
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
  [...document.querySelectorAll("button")].some((b) => b.textContent.includes("تأیید واریز"))
);
check("approve button shown for a waiting card order", hasApprove);

await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("تأیید واریز")).click();
});
await wait(3500);

const approved = await db.order.findUnique({ where: { id: order.id } });
check("status becomes PAID after approval", approved.status === "PAID", approved.status);
check("points flagged as granted", approved.pointsAwarded === true);
check("no instalment timestamp written for a card order", approved.snapppayApprovedAt === null);

const pointsGranted = (await db.user.findUnique({ where: { phone: PHONE } })).points - pointsBefore;
check("club points granted once", pointsGranted > 0, `+${pointsGranted}`);
check("stock NOT decremented a second time",
  (await db.product.findUnique({ where: { id: product.id } })).stock === stockBefore - 2);

// ── 5. Double approval is a no-op ─────────────────────────────
log("\n5) DOUBLE-APPROVAL GUARD");
await page.goto(`${BASE}/admin/orders/${order.id}`, { waitUntil: "networkidle2" });
await wait(800);
check("approve button gone once approved", !(await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((b) => b.textContent.includes("تأیید واریز"))
)));

await page.evaluate(() => {
  const sel = document.querySelector('select[name="status"]');
  sel.value = "PAID";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ذخیره")).click();
});
await wait(3000);
check("points NOT granted twice",
  (await db.user.findUnique({ where: { phone: PHONE } })).points - pointsBefore === pointsGranted);
check("stock NOT taken twice",
  (await db.product.findUnique({ where: { id: product.id } })).stock === stockBefore - 2);

// ── 6. Cancellation returns stock ─────────────────────────────
log("\n6) CANCELLATION RETURNS STOCK");
await page.evaluate(() => {
  const sel = document.querySelector('select[name="status"]');
  sel.value = "CANCELLED";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ذخیره")).click();
});
await wait(3000);
check("reserved goods returned to the shelf",
  (await db.product.findUnique({ where: { id: product.id } })).stock === stockBefore,
  `back to ${stockBefore}`);

// ── cleanup ───────────────────────────────────────────────────
await browser.close();
await db.orderItem.deleteMany({ where: { order: { user: { phone: PHONE } } } });
await db.order.deleteMany({ where: { user: { phone: PHONE } } });
await db.user.deleteMany({ where: { phone: PHONE } });
await db.product.update({ where: { id: product.id }, data: { stock: stockBefore } });
await db.otp.deleteMany({ where: { phone: PHONE } });

log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
await db.$disconnect();
process.exit(failures === 0 ? 0 : 1);
