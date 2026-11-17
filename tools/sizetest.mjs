/**
 * Sizes end to end.
 *
 *   npx next build && npx next start     (one terminal)
 *   node tools/sizetest.mjs              (another)
 *
 * Four things have to hold, and each of them is a way the shop could lose money
 * or sell something it cannot make:
 *
 *   · the estimator's arithmetic (pure functions, imported straight from
 *     src/lib/sizing.ts - Node strips the types itself)
 *   · a size's own price, not the product's, is what the buyer is charged
 *   · a سایز سفارشی line is refused by the SERVER, not just hidden in the UI
 *   · stock comes off the size row that was actually bought
 */
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { TEST_IP } from "./testlogin.mjs";
import {
  estimateHip, estimateSize, hemSentence, pickKidSize, pickSize, roundToEvenSize, sizeFromHip,
} from "../src/lib/sizing.ts";

const db = new PrismaClient();
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
const PHONE = "09121117799"; // test customer, kept apart from the other suites
const TAG = "test-size-product";
const PLAIN_TAG = "test-sizeless-product";

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

// ═════════════════════════════════════════════════════════════════════
console.log("\n1) ESTIMATOR ARITHMETIC");

// Iranian sizing: size = 36 + (hip − 88) / 4, one size per 4 cm of hip
check("hip 88 → size 36", sizeFromHip(88) === 36);
check("hip 100 → size 39", sizeFromHip(100) === 39);
check("hip 104 → size 40", sizeFromHip(104) === 40);
check("sizes round to the nearest even number",
  roundToEvenSize(39) === 40 && roundToEvenSize(38.9) === 38 && roundToEvenSize(38.4) === 38);

// خانم: hip ≈ 2.0 × BMI + 53 + 0.2 × (height − 165)
const herHip = 2.0 * (65 / 1.68 ** 2) + 53 + 0.2 * (168 - 165);
check("خانم hip formula matches the spec exactly",
  Math.abs(estimateHip("female", 168, 65) - herHip) < 1e-9, `hip ≈ ${herHip.toFixed(1)}`);
// آقا: hip ≈ 1.8 × BMI + 53 + 0.2 × (height − 175)
const hisHip = 1.8 * (80 / 1.8 ** 2) + 53 + 0.2 * (180 - 175);
check("آقا hip formula matches the spec exactly",
  Math.abs(estimateHip("male", 180, 80) - hisHip) < 1e-9, `hip ≈ ${hisHip.toFixed(1)}`);

// Known height/weight → size cases, all straight from the two formulas above.
const cases = [
  { who: "female", heightCm: 158, weightKg: 50, expect: 36 },
  { who: "female", heightCm: 168, weightKg: 65, expect: 38 }, // raw 38.9 - borderline
  { who: "female", heightCm: 175, weightKg: 75, expect: 40 },
  { who: "female", heightCm: 170, weightKg: 90, expect: 44 },
  { who: "male", heightCm: 180, weightKg: 80, expect: 38 },
  { who: "male", heightCm: 178, weightKg: 100, expect: 42 },
];
for (const c of cases) {
  const got = estimateSize(c);
  check(`${c.who === "male" ? "آقا" : "خانم"} ${c.heightCm}/${c.weightKg} → size ${c.expect}`,
    got.size === c.expect, `got ${got.size} (raw ${got.raw.toFixed(2)})`);
}
check("every estimate is an even number inside 34..56",
  cases.every((c) => {
    const n = estimateSize(c).size;
    return n % 2 === 0 && n >= 34 && n <= 56;
  }));

// 38.9 sits nine tenths of a size above 38 - the buyer must be told
check("a near-boundary estimate is flagged as «بین دو سایزی»",
  estimateSize({ who: "female", heightCm: 168, weightKg: 65 }).betweenSizes);
check("a comfortably central estimate is not flagged",
  !estimateSize({ who: "female", heightCm: 175, weightKg: 75 }).betweenSizes);

check("«سایز معمولی‌ات» beats height and weight",
  estimateSize({ who: "female", heightCm: 150, weightKg: 45, usualSize: 46 }).size === 46);
check("a measured hip beats the BMI estimate",
  estimateSize({ who: "female", heightCm: 150, weightKg: 45, hipCm: 104 }).size === 40);
check("«کمی آزادتر» adds exactly one size",
  estimateSize({ who: "female", hipCm: 104, fit: "loose" }).size === 42);
check("size is clamped to 56 at the top", estimateSize({ who: "female", hipCm: 200 }).size === 56);
check("size is clamped to 34 at the bottom", estimateSize({ who: "female", hipCm: 60 }).size === 34);
check("nothing to go on → no answer at all", estimateSize({ who: "female" }) === null);

// ═════════════════════════════════════════════════════════════════════
console.log("\n2) MATCHING AN ESTIMATE TO WHAT THE PRODUCT OFFERS");

const opt = (o) => ({
  fitFrom: null, fitTo: null, heightFrom: null, heightTo: null, lengthCm: null, ...o,
});
const graded = [
  opt({ id: "s", label: "S", kind: "STANDARD", fitFrom: 38, fitTo: 40, lengthCm: 90 }),
  opt({ id: "m", label: "M", kind: "STANDARD", fitFrom: 42, fitTo: 44, lengthCm: 95 }),
  opt({ id: "c", label: "سایز سفارشی", kind: "CUSTOM" }),
];
check("size 40 → S", pickSize(graded, 40).size.id === "s");
check("size 42 → M", pickSize(graded, 42).size.id === "m");
check("size 40 is flagged as sitting at the top of S", pickSize(graded, 40).atTopOfRange);
check("size 42 is not (it is the bottom of M)", !pickSize(graded, 42).atTopOfRange);
check("bigger than every size on offer → سایز سفارشی", pickSize(graded, 54).how === "custom");

const freeOnly = [
  opt({ id: "f", label: "فری‌سایز", kind: "FREE", fitFrom: 36, fitTo: 54, lengthCm: 90 }),
  opt({ id: "c", label: "سایز سفارشی", kind: "CUSTOM" }),
];
check("no standard size, but فری‌سایز covers it → فری‌سایز", pickSize(freeOnly, 44).how === "free");
check("bigger than فری‌سایز → سایز سفارشی", pickSize(freeOnly, 56).how === "custom");

const kidRows = [
  opt({ id: "k1", label: "۴–۶ سال", kind: "STANDARD", fitFrom: 4, fitTo: 6, heightFrom: 104, heightTo: 120 }),
  opt({ id: "k2", label: "۷–۹ سال", kind: "STANDARD", fitFrom: 7, fitTo: 9, heightFrom: 120, heightTo: 135 }),
  opt({ id: "kc", label: "سایز سفارشی", kind: "CUSTOM" }),
];
check("child 125 cm → ۷–۹ سال", pickKidSize(kidRows, 125, null).size.id === "k2");
check("child of 5 with no height → ۴–۶ سال", pickKidSize(kidRows, null, 5).size.id === "k1");
check("child taller than every kids size → سایز سفارشی",
  pickKidSize(kidRows, 175, null).how === "custom");

// hem above the floor = 0.82 × height − length; knee = 0.285 × height
check("a 90 cm piece on a 168 cm body lands at the knee",
  hemSentence(168, 90).includes("زانو"), hemSentence(168, 90));
check("a short piece reads as mid-thigh or above",
  /ران/.test(hemSentence(168, 60)), hemSentence(168, 60));
check("a long piece reads as below the knee",
  /پایین‌تر از زانو/.test(hemSentence(168, 110)), hemSentence(168, 110));

// ═════════════════════════════════════════════════════════════════════
// Everything below goes through the running site, because the point is that
// the SERVER enforces these rules - not the browser.
console.log("\n3) PER-SIZE PRICING THROUGH A REAL CHECKOUT");

const cleanup = async () => {
  await db.orderItem.deleteMany({ where: { product: { slug: { in: [TAG, PLAIN_TAG] } } } });
  await db.order.deleteMany({ where: { user: { phone: PHONE } } });
  await db.productSize.deleteMany({ where: { product: { slug: TAG } } });
  await db.product.deleteMany({ where: { slug: { in: [TAG, PLAIN_TAG] } } });
};

try {
  await cleanup();

  // Log in with a password rather than an OTP: /api/auth/otp/request allows
  // only 5 requests per IP per 10 minutes and the other suites already use
  // three of them, so a fourth would make `npm run test:all` flaky.
  const PASSWORD = "size-suite-password";
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(PASSWORD, salt, 64).toString("hex")}`;
  await db.user.upsert({
    where: { phone: PHONE },
    update: { passwordHash },
    create: { phone: PHONE, name: "تست سایز", passwordHash },
  });

  const loginRes = await fetch(`${BASE}/api/auth/password`, {
    method: "POST",
    // per-run address: /api/auth/password allows 10 tries per 10 minutes per IP,
    // so without this a repeat run of the suite fails at login for reasons that
    // have nothing to do with what is being tested
    headers: { "Content-Type": "application/json", "X-Real-Ip": TEST_IP },
    body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
  });
  const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  check("test customer logged in", !!cookie, `HTTP ${loginRes.status}`);

  // ── a product with two differently priced sizes, plus a سایز سفارشی ──
  const leaf = await db.category.findFirst({ where: { parentId: { not: null } } })
    ?? await db.category.findFirst();

  const product = await db.product.create({
    data: {
      slug: TAG,
      nameFa: "محصول آزمایشی سایز",
      description: "ساخته‌شده توسط tools/sizetest.mjs",
      price: 1_000_000, // deliberately NOT what either size costs
      image: "/images/spa.jpg",
      stock: 6,
      categoryId: leaf.id,
      sizes: {
        create: [
          // Sizes are priced as a difference from Product.price, so S is the
          // base minus 100k and L is the base plus 500k. `price` is the derived
          // mirror the app keeps in step; nothing prices off it.
          { label: "S", rangeLabel: "۳۸–۴۰", kind: "STANDARD", priceDelta: -100_000, price: 900_000, stock: 4, fitFrom: 38, fitTo: 40, sort: 0 },
          { label: "L", rangeLabel: "۴۶–۴۸", kind: "STANDARD", priceDelta: 500_000, price: 1_500_000, salePrice: 1_200_000, stock: 2, fitFrom: 46, fitTo: 48, sort: 1 },
          { label: "سایز سفارشی", rangeLabel: "با هماهنگی", kind: "CUSTOM", priceDelta: 0, price: 0, stock: 0, sort: 2 },
        ],
      },
    },
    include: { sizes: true },
  });
  const small = product.sizes.find((s) => s.label === "S");
  const large = product.sizes.find((s) => s.label === "L");
  const bespoke = product.sizes.find((s) => s.kind === "CUSTOM");

  // a product from before sizes existed: no size rows at all
  const plain = await db.product.create({
    data: {
      slug: PLAIN_TAG,
      nameFa: "محصول آزمایشی بدون سایز",
      description: "ساخته‌شده توسط tools/sizetest.mjs",
      price: 700_000,
      salePrice: 600_000,
      image: "/images/spa.jpg",
      stock: 5,
      categoryId: leaf.id,
    },
  });

  const order = (items, extra = {}) =>
    fetch(`${BASE}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        items,
        firstName: "تست", lastName: "سایز", province: "تهران", city: "تهران",
        address: "خیابان آزمایش", phone: PHONE,
        // CARD reserves stock the moment the order is placed, which is exactly
        // the path we want to watch
        paymentMethod: "CARD",
        ...extra,
      }),
    });

  // ── the server's refusals ──
  const customRes = await order([{ id: product.id, qty: 1, sizeId: bespoke.id }]);
  const customBody = await customRes.json();
  check("سایز سفارشی is refused by the server", customRes.status === 400,
    `HTTP ${customRes.status}`);
  check("…with a message that sends the buyer to واتس‌اپ",
    typeof customBody.error === "string" && customBody.error.includes("واتس‌اپ"), customBody.error);

  const sizelessRes = await order([{ id: product.id, qty: 1 }]);
  const sizelessBody = await sizelessRes.json();
  check("a sizeless line for a product WITH sizes is refused", sizelessRes.status === 400,
    `HTTP ${sizelessRes.status} ${sizelessBody.error ?? ""}`);

  const overRes = await order([{ id: product.id, qty: 5, sizeId: large.id }]);
  const overBody = await overRes.json();
  check("ordering past ONE size's stock is rejected, not the product total",
    overRes.status === 409, `HTTP ${overRes.status} — L has ${large.stock}, product has ${product.stock}`);
  check("…and the message names the size", (overBody.error ?? "").includes("L"), overBody.error);

  const stillThere = await db.product.findUnique({ where: { id: product.id }, include: { sizes: true } });
  check("a refused order took no stock at all",
    stillThere.stock === 6 && stillThere.sizes.find((s) => s.id === small.id).stock === 4);

  // ── the real thing: two sizes of one product, in one order ──
  const okRes = await order([
    { id: product.id, qty: 1, sizeId: small.id },
    { id: product.id, qty: 2, sizeId: large.id },
    { id: plain.id, qty: 1 },
  ]);
  const okBody = await okRes.json();
  check("the order is accepted", okBody.ok === true, JSON.stringify(okBody).slice(0, 160));

  const placed = await db.order.findUnique({
    where: { id: okBody.orderId },
    include: { items: { orderBy: { unitPrice: "asc" } } },
  });
  check("the same product in two sizes is two order lines",
    placed.items.filter((i) => i.productId === product.id).length === 2);

  const lineS = placed.items.find((i) => i.sizeId === small.id);
  const lineL = placed.items.find((i) => i.sizeId === large.id);
  const lineP = placed.items.find((i) => i.productId === plain.id);

  check("size S is charged base + its own delta, not the bare base",
    lineS.unitPrice === 900_000, `${lineS.unitPrice} (base ${product.price} − 100000)`);
  check("size L is charged its own SALE price",
    lineL.unitPrice === 1_200_000, `${lineL.unitPrice}`);
  check("the size label is stored on the order line, not just the id",
    lineS.sizeLabel === "S" && lineL.sizeLabel === "L");
  check("a product with no sizes still buys at its old price",
    lineP.unitPrice === 600_000 && lineP.sizeId === null, `${lineP.unitPrice}`);
  check("the order total adds the size prices up",
    placed.goodsTotal === 900_000 + 2 * 1_200_000 + 600_000, `${placed.goodsTotal}`);

  // ═══════════════════════════════════════════════════════════════════
  console.log("\n4) STOCK COMES OFF THE RIGHT SIZE ROW");

  const after = await db.product.findUnique({ where: { id: product.id }, include: { sizes: true } });
  const afterS = after.sizes.find((s) => s.id === small.id);
  const afterL = after.sizes.find((s) => s.id === large.id);
  const afterC = after.sizes.find((s) => s.id === bespoke.id);

  check("size S lost exactly 1", afterS.stock === 3, `S = ${afterS.stock}`);
  check("size L lost exactly 2", afterL.stock === 0, `L = ${afterL.stock}`);
  check("سایز سفارشی was never touched", afterC.stock === 0);
  check("Product.stock is the sum of its sizes",
    after.stock === after.sizes.reduce((s, r) => s + r.stock, 0) && after.stock === 3,
    `product ${after.stock}`);

  const afterPlain = await db.product.findUnique({ where: { id: plain.id } });
  check("a sizeless product still decrements its own stock",
    afterPlain.stock === 4, `${afterPlain.stock}`);

  // ── the product page reflects all of this ──
  console.log("\n5) THE PRODUCT PAGE");
  const html = (await (await fetch(`${BASE}/products/${TAG}`)).text()).replaceAll("<!-- -->", "");
  check("both size labels are rendered", html.includes("۳۸–۴۰") && html.includes("۴۶–۴۸"));
  check("سایز سفارشی is offered as a choice", html.includes("سایز سفارشی"));
  check("the headline price is the cheapest buyable size",
    html.includes((900_000).toLocaleString("fa-IR")));
  check("the size guide is linked from the product page", html.includes("/size-guide"));

  check("the estimator is offered on a product whose sizes carry a fit range",
    html.includes("سایزم را پیدا کن"));

  // A فری‌سایز piece still needs the estimator - «۳۶–۵۴» is a claim the buyer
  // wants checked - but a hat or a towel has dimensions, not a fit.
  const freeSized = await db.product.findFirst({
    where: { active: true, sizes: { some: { kind: "FREE", fitTo: { not: null } } } },
  });
  if (freeSized) {
    const freeHtml = await (await fetch(`${BASE}/products/${freeSized.slug}`)).text();
    check("…and on a فری‌سایز piece too", freeHtml.includes("سایزم را پیدا کن"), freeSized.slug);
  }
  const dimensioned = await db.product.findFirst({
    where: {
      active: true,
      sizes: { some: {}, every: { fitTo: null, heightTo: null } },
    },
  });
  if (dimensioned) {
    const dimHtml = await (await fetch(`${BASE}/products/${dimensioned.slug}`)).text();
    check("…but NOT on something sized by dimensions (towel, bag, hat)",
      !dimHtml.includes("سایزم را پیدا کن"), dimensioned.slug);
  }

  const guide = (await (await fetch(`${BASE}/size-guide`)).text()).replaceAll("<!-- -->", "");
  check("the size guide renders the wearable table from the DB",
    guide.includes("۳۸–۴۰") && guide.includes("۸۹–۹۶"));
  check("the size guide renders the kids table from the DB", guide.includes("۱۰۴–۱۲۰"));
} finally {
  await cleanup();
}

console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
await db.$disconnect();
process.exit(fails === 0 ? 0 : 1);
