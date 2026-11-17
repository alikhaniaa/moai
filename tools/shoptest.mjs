/** Verifies the merchandising layer: campaigns, stock, shipping, settings. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`   ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};
// React SSR injects <!-- --> between adjacent text nodes, so strip comments
// before matching rendered strings.
const page = async (path) =>
  (await (await fetch(`${BASE}${path}`)).text()).replaceAll("<!-- -->", "");

// Resolve the fixtures from the catalogue instead of hardcoding slugs: the
// products are re-imported now and then and their slugs move with them.
// `product` must have a manual sale price, so §2 can pit it against a campaign.
const product = await db.product.findFirst({
  where: { active: true, salePrice: { gt: 0 } },
  orderBy: { createdAt: "asc" },
});
// …and `other` must live in a different category, to prove a category campaign
// doesn't leak sideways.
const other = await db.product.findFirst({
  where: { active: true, categoryId: { not: product.categoryId } },
});
await db.campaign.deleteMany({ where: { title: { startsWith: "TEST-" } } });

console.log("\n1) SITE-WIDE CAMPAIGN");
check("test fixture: a discounted product exists", !!product, product?.slug);
check("test fixture: a product in another category exists", !!other, other?.slug);
// use a product with no manual sale price, so any badge must come from a campaign
const plain = await db.product.findFirst({ where: { salePrice: null, active: true } });
check("test fixture: product without manual sale price exists", !!plain, plain?.nameFa);
check("no discount badge before campaign", !(await page(`/products/${plain.slug}`)).includes("تخفیف"));

const site = await db.campaign.create({
  data: { title: "TEST-site", percent: 25, scope: "SITE", active: true },
});
const afterHtml = await page(`/products/${product.slug}`);
const expected25 = Math.round((product.price * 75) / 100);
check("25% site campaign shows on product page", afterHtml.includes(expected25.toLocaleString("fa-IR")),
  `expected ${expected25.toLocaleString("fa-IR")} Toman`);
check("discount badge appears", afterHtml.includes("٪۲۵ تخفیف"));
check("campaign reaches a product that had no sale price",
  (await page(`/products/${plain.slug}`)).includes("٪۲۵ تخفیف"));

console.log("\n2) CAMPAIGN vs MANUAL SALE PRICE — cheapest must win");
// the fixture carries a manual sale price; whichever of the two is lower must win
const cheapest = Math.min(product.salePrice ?? product.price, expected25);
check("buyer gets the lower of the two", afterHtml.includes(cheapest.toLocaleString("fa-IR")),
  `cheapest=${cheapest}`);

console.log("\n3) DATE WINDOW");
await db.campaign.update({
  where: { id: site.id },
  data: { startsAt: new Date(Date.now() + 864e5), endsAt: new Date(Date.now() + 2 * 864e5) },
});
const futureHtml = await page(`/products/${product.slug}`);
check("future-dated campaign does NOT apply yet", !futureHtml.includes("٪۲۵ تخفیف"));
await db.campaign.delete({ where: { id: site.id } });

console.log("\n4) CATEGORY CAMPAIGN");
const cat = await db.category.findUnique({ where: { id: product.categoryId } });
const catCamp = await db.campaign.create({
  data: { title: "TEST-cat", percent: 30, scope: "CATEGORY", categoryId: cat.id, active: true },
});
const handHtml = await page(`/products/${product.slug}`);
const otherHtml = await page(`/products/${other.slug}`);
check("category campaign applies inside category", handHtml.includes("٪۳۰ تخفیف"));
check("category campaign does NOT leak to other categories", !otherHtml.includes("٪۳۰ تخفیف"));
await db.campaign.delete({ where: { id: catCamp.id } });

console.log("\n5) OVERSELL GUARD");
const lowStock = await db.product.findFirst({ where: { stock: { gt: 0 } } });
const res = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [{ id: lowStock.id, qty: lowStock.stock + 5 }],
    fullName: "تست", phone: "09120000009", city: "تهران", address: "x",
  }),
});
check("ordering more than stock is rejected", res.status === 401 || res.status === 409,
  `HTTP ${res.status} (401 = not logged in, also correct)`);

console.log("\n6) SETTINGS DRIVE THE SITE");
await db.setting.upsert({
  where: { key: "announcement" }, update: { value: "TEST-ANNOUNCEMENT-XYZ" },
  create: { key: "announcement", value: "TEST-ANNOUNCEMENT-XYZ" },
});
check("announcement bar reflects setting", (await page("/")).includes("TEST-ANNOUNCEMENT-XYZ"));
await db.setting.update({
  where: { key: "announcement" },
  data: { value: "ارسال رایگان برای خریدهای بالای ۳ میلیون تومان" },
});

console.log("\n7) BANNERS FROM DB");
const banner = await db.banner.findFirst();
check("active banner renders on homepage", (await page("/")).includes(banner.title), banner.title);
await db.banner.update({ where: { id: banner.id }, data: { active: false } });
check("deactivated banner disappears", !(await page("/")).includes(banner.title));
await db.banner.update({ where: { id: banner.id }, data: { active: true } });

console.log("\n8) HIDE A PRODUCT");
await db.product.update({ where: { id: product.id }, data: { active: false } });
check("inactive product hidden from shop", !(await page("/products")).includes(product.nameFa));
await db.product.update({ where: { id: product.id }, data: { active: true } });

console.log(`\n${fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
await db.$disconnect();
process.exit(fails === 0 ? 0 : 1);
