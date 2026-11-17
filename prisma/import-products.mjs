import { PrismaClient } from "@prisma/client";
import fs from "fs";

const db = new PrismaClient();
const SRC = process.argv[2] || "products.json";

// ── category structure (built from the real catalog) ──────────────
const CATEGORIES = [
  { slug: "poncho", nameFa: "پانچو کلاه‌دار", image: "/images/surf.jpg", sort: 0 },
  { slug: "bathrobe", nameFa: "حوله تن‌پوش و رومایویی", image: "/images/boho.jpg", sort: 1 },
  { slug: "beach-mat", nameFa: "زیرانداز ساحلی", image: "/images/palms.jpg", sort: 2 },
  { slug: "waterproof-mat", nameFa: "زیرانداز ضدآب", image: "/images/aerial.jpg", sort: 3 },
  { slug: "body", nameFa: "حوله بدن و استخری", image: "/images/pool.jpg", sort: 4 },
  { slug: "hand", nameFa: "حوله دست و صورت", image: "/images/bath.jpg", sort: 5 },
  { slug: "kitchen", nameFa: "حوله آشپزخانه", image: "/images/hangers.jpg", sort: 6 },
  { slug: "kids", nameFa: "بچگانه", image: "/images/kids.jpg", sort: 7 },
  { slug: "accessory", nameFa: "کیف و اکسسوری", image: "/images/spa.jpg", sort: 8 },
];

// a placeholder image per category (swapped for real photos later)
const CAT_IMG = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.image]));

function categoryOf(name, cats) {
  const t = (name + " " + cats.join(" ")).toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has("ضدآب", "ضد آب")) return "waterproof-mat";
  if (has("زیرانداز", "سفر و ساحل")) return "beach-mat";
  if (has("پانچو")) return "poncho";
  if (has("کودک", "بچه", "نوجوان", "بچگانه")) return "kids";
  if (has("آشپزخانه", "دستمال")) return "kitchen";
  if (has("هدبند", "کلاه", "کیف", "ارگانایزر", "نظم")) return "accessory";
  if (has("رومایویی", "تنپوش", "تن‌پوش", "تن پوش", "حمام")) return "bathrobe";
  if (has("بدن", "استخری")) return "body";
  if (has("دست", "صورت", "دستی")) return "hand";
  return "bathrobe";
}

// ── clean WordPress HTML into readable plain text ─────────────────
function cleanHtml(html) {
  if (!html) return "";
  let t = html
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n") // WordPress export stored literal backslash-n
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&zwnj;/gi, "‌")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#8203;/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t;
}

// ASCII slug: category-N. Persian slugs 404 (Next URL normalization), so we
// never put non-ASCII in the path.
function makeSlug(catSlug, counter, used) {
  counter[catSlug] = (counter[catSlug] || 0) + 1;
  let out = `${catSlug}-${counter[catSlug]}`;
  while (used.has(out)) out = `${catSlug}-${++counter[catSlug]}`;
  used.add(out);
  return out;
}

async function main() {
  const products = JSON.parse(fs.readFileSync(SRC, "utf8"));
  console.log(`importing ${products.length} products…`);

  // categories
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { nameFa: c.nameFa, image: c.image, sort: c.sort },
      create: c,
    });
  }
  const catId = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));

  const used = new Set();
  const counter = {};
  const importedSlugs = [];
  let featuredCount = 0;

  for (const p of products) {
    const cat = categoryOf(p.name, p.cats);
    const slug = makeSlug(cat, counter, used);
    importedSlugs.push(slug);
    const cleanName = p.name.replace(/^اسم\s*[:：]\s*/, "").trim();
    const desc = cleanHtml(p.desc || p.short);
    const price = p.price > 0 ? p.price : 0;
    // feature the first few nice items on the homepage
    const featured = featuredCount < 8 && price > 0 && cat !== "accessory";
    if (featured) featuredCount++;

    await db.product.upsert({
      where: { slug },
      update: {
        nameFa: cleanName, description: desc, price,
        salePrice: p.sale && p.sale < price ? p.sale : null,
        stock: p.stock ?? 20, categoryId: catId[cat],
        image: CAT_IMG[cat], active: price > 0, featured,
      },
      create: {
        slug, nameFa: cleanName, description: desc, price,
        salePrice: p.sale && p.sale < price ? p.sale : null,
        stock: p.stock ?? 20, categoryId: catId[cat],
        image: CAT_IMG[cat], active: price > 0, featured,
      },
    });
  }

  // retire old seed products that aren't part of the real catalog
  const stale = await db.product.findMany({
    where: { slug: { notIn: importedSlugs } },
    include: { _count: { select: { orderItems: true } } },
  });
  for (const sp of stale) {
    if (sp._count.orderItems === 0) {
      await db.product.delete({ where: { id: sp.id } });
    } else {
      await db.product.update({ where: { id: sp.id }, data: { active: false } });
    }
  }
  // drop unused old categories with no products
  const emptyCats = await db.category.findMany({
    where: { slug: { notIn: CATEGORIES.map((c) => c.slug) } },
    include: { _count: { select: { products: true } } },
  });
  for (const ec of emptyCats) {
    if (ec._count.products === 0) await db.category.delete({ where: { id: ec.id } });
  }

  const byCat = {};
  for (const c of CATEGORIES) {
    byCat[c.nameFa] = await db.product.count({ where: { categoryId: catId[c.slug], active: true } });
  }
  console.log("done. products per category:");
  console.log(JSON.stringify(byCat, null, 1));
  console.log(`retired ${stale.length} old products.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
