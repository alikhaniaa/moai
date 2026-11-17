/**
 * One-off upgrade: size charts, per-size pricing, the category tree and the
 * curated homepage slots.
 *
 *   node prisma/upgrade-sizes.mjs
 *
 * Every phase is idempotent - re-running it never duplicates a row and never
 * overwrites an edit made in the admin panel afterwards. That matters because
 * this script runs once locally and once on the server, against a database
 * that already holds real products.
 *
 * Phases
 *   1. جدول سایزها - the global size presets (§1.4 A–E)
 *   2. Category tree - parents, new leaves, and the product moves
 *   3. Per-product sizes, priced and stocked exactly as the product is today
 *   4. Small data fixes
 *   5. Homepage slots seeded from what the homepage shows right now
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const log = (...a) => console.log(...a);

// ── 1. جدول سایزها ───────────────────────────────────────────────────
const CHARTS = [
  {
    key: "wearable",
    nameFa: "پانچو، حوله تن‌پوش، رومایویی و کیمونو",
    intro: "این‌ها روی بدن خیس پوشیده می‌شوند و عمداً آزادتر از لباس معمولی دوخته شده‌اند.",
    col2Label: "مناسب سایز لباس",
    col3Label: "دور باسن (سانتی‌متر)",
    rows: [
      { label: "XS", rangeLabel: "۳۴–۳۶", extraLabel: "تا ۸۸", fitFrom: 34, fitTo: 36 },
      { label: "S", rangeLabel: "۳۸–۴۰", extraLabel: "۸۹–۹۶", fitFrom: 38, fitTo: 40 },
      { label: "M", rangeLabel: "۴۲–۴۴", extraLabel: "۹۷–۱۰۴", fitFrom: 42, fitTo: 44 },
      { label: "L", rangeLabel: "۴۶–۴۸", extraLabel: "۱۰۵–۱۱۲", fitFrom: 46, fitTo: 48 },
      { label: "XL", rangeLabel: "۵۰–۵۲", extraLabel: "۱۱۳–۱۲۰", fitFrom: 50, fitTo: 52 },
      { label: "XXL", rangeLabel: "۵۴–۵۶", extraLabel: "۱۲۱–۱۲۸", fitFrom: 54, fitTo: 56 },
      { label: "فری‌سایز", rangeLabel: "۳۶–۵۴", extraLabel: "تا ۱۲۴", kind: "FREE", fitFrom: 36, fitTo: 54 },
      { label: "سایز سفارشی", rangeLabel: "هر سایز و هر قدی", extraLabel: "با هماهنگی", kind: "CUSTOM" },
    ],
  },
  {
    key: "kids",
    nameFa: "بچگانه",
    intro: "سایز بچگانه با قد کودک انتخاب می‌شود؛ سن فقط وقتی به کار می‌آید که قد را ندانی.",
    col2Label: "سن",
    col3Label: "قد کودک (سانتی‌متر)",
    rows: [
      { label: "۴–۶ سال", rangeLabel: "۴ تا ۶", extraLabel: "۱۰۴–۱۲۰", fitFrom: 4, fitTo: 6, heightFrom: 104, heightTo: 120 },
      { label: "۷–۹ سال", rangeLabel: "۷ تا ۹", extraLabel: "۱۲۰–۱۳۵", fitFrom: 7, fitTo: 9, heightFrom: 120, heightTo: 135 },
      { label: "۱۰–۱۲ سال", rangeLabel: "۱۰ تا ۱۲", extraLabel: "۱۳۵–۱۵۰", fitFrom: 10, fitTo: 12, heightFrom: 135, heightTo: 150 },
      { label: "۱۳–۱۴ سال", rangeLabel: "۱۳ تا ۱۴", extraLabel: "۱۵۰–۱۶۵", fitFrom: 13, fitTo: 14, heightFrom: 150, heightTo: 165 },
      { label: "سایز سفارشی", rangeLabel: "—", extraLabel: "با هماهنگی", kind: "CUSTOM" },
    ],
  },
  {
    key: "towel",
    nameFa: "حوله",
    intro: "حوله‌ها با ابعاد انتخاب می‌شوند، نه با سایز بدن.",
    col2Label: "ابعاد (سانتی‌متر)",
    col3Label: "",
    rows: [
      { label: "صورت", rangeLabel: "۴۵×۴۵" },
      { label: "دست و صورت", rangeLabel: "۴۵×۷۰" },
      { label: "بدن و استخری", rangeLabel: "۹۰×۱۷۰" },
      { label: "آشپزخانه", rangeLabel: "۳۰×۶۰" },
    ],
  },
  {
    key: "mat",
    nameFa: "زیرانداز",
    intro: "",
    col2Label: "ابعاد (سانتی‌متر)",
    col3Label: "",
    rows: [
      { label: "ساحلی یک‌نفره", rangeLabel: "۷۵×۱۷۰" },
      { label: "ضدآب", rangeLabel: "۱۶۰×۲۰۰" },
      { label: "سایز سفارشی", rangeLabel: "ابعاد بزرگ‌تر با هماهنگی", kind: "CUSTOM" },
    ],
  },
  {
    key: "accessory",
    nameFa: "کیف، اکسسوری و منسوجات خانه",
    intro: "",
    col2Label: "ابعاد (سانتی‌متر)",
    col3Label: "",
    rows: [
      { label: "کیف و ارگانایزر", rangeLabel: "۳۲×۲۲" },
      { label: "روتختی", rangeLabel: "۱۸۰×۱۸۰" },
      { label: "فری‌سایز", rangeLabel: "یک اندازه", kind: "FREE" },
    ],
  },
  {
    key: "hat",
    nameFa: "کلاه",
    intro:
      "دور سر را درست بالای گوش‌ها و وسط پیشانی اندازه بگیر. بیشتر کلاه‌های موآی کشی یا حصیری‌اند و بازه‌ی خوبی را می‌پوشانند.",
    col2Label: "اندازه",
    col3Label: "",
    rows: [
      { label: "فری‌سایز", rangeLabel: "دور سر ۵۵–۵۹", kind: "FREE" },
      { label: "مدیوم", rangeLabel: "دور سر ۵۶–۵۸" },
    ],
  },
];

async function seedCharts() {
  log("\n1) جدول سایزها");
  for (const [sort, c] of CHARTS.entries()) {
    const chart = await db.sizeChart.upsert({
      where: { key: c.key },
      update: {}, // never clobber a rename made in the admin panel
      create: {
        key: c.key, nameFa: c.nameFa, intro: c.intro,
        col2Label: c.col2Label, col3Label: c.col3Label, sort,
      },
    });

    const existing = await db.sizeChartRow.count({ where: { chartId: chart.id } });
    if (existing > 0) {
      log(`   · ${c.nameFa} — از قبل ${existing} ردیف دارد، دست نخورد`);
      continue;
    }
    await db.sizeChartRow.createMany({
      data: c.rows.map((r, i) => ({
        chartId: chart.id,
        label: r.label,
        rangeLabel: r.rangeLabel ?? "",
        extraLabel: r.extraLabel ?? "",
        kind: r.kind ?? "STANDARD",
        fitFrom: r.fitFrom ?? null,
        fitTo: r.fitTo ?? null,
        heightFrom: r.heightFrom ?? null,
        heightTo: r.heightTo ?? null,
        lengthCm: r.lengthCm ?? null,
        sort: i,
      })),
    });
    log(`   ✓ ${c.nameFa} — ${c.rows.length} ردیف`);
  }
}

// ── 2. Category tree ─────────────────────────────────────────────────
/** parents in display order; the first one becomes the big homepage tile */
const PARENTS = [
  { slug: "tanpoosh", nameFa: "تن‌پوش و پانچو", image: "/images/surf.jpg" },
  { slug: "towels", nameFa: "حوله", image: "/images/pool.jpg" },
  { slug: "mats", nameFa: "زیرانداز", image: "/images/palms.jpg" },
  { slug: "kids", nameFa: "بچگانه", image: "/images/kids.jpg" },
  { slug: "accessory", nameFa: "کیف و اکسسوری", image: "/images/spa.jpg" },
];

/** leaf slug → its parent, in the order they should appear under it */
const LEAVES = [
  { slug: "poncho", nameFa: "پانچو کلاه‌دار", parent: "tanpoosh", image: "/images/surf.jpg" },
  { slug: "bathrobe", nameFa: "حوله تن‌پوش و رومایویی", parent: "tanpoosh", image: "/images/boho.jpg" },
  { slug: "kimono", nameFa: "کیمونو", parent: "tanpoosh", image: "/images/spa.jpg" },

  { slug: "body", nameFa: "حوله بدن و استخری", parent: "towels", image: "/images/pool.jpg" },
  { slug: "hand", nameFa: "حوله دست و صورت", parent: "towels", image: "/images/bath.jpg" },
  { slug: "kitchen", nameFa: "حوله آشپزخانه", parent: "towels", image: "/images/hangers.jpg" },

  { slug: "beach-mat", nameFa: "زیرانداز ساحلی", parent: "mats", image: "/images/palms.jpg" },
  { slug: "waterproof-mat", nameFa: "زیرانداز ضدآب", parent: "mats", image: "/images/aerial.jpg" },

  { slug: "bags", nameFa: "کیف و ارگانایزر", parent: "accessory", image: "/images/stripes.jpg" },
  { slug: "hats", nameFa: "کلاه", parent: "accessory", image: "/images/sunset.jpg" },
  { slug: "bath-accessory", nameFa: "اکسسوری حمام", parent: "accessory", image: "/images/spa.jpg" },
  { slug: "home-textile", nameFa: "منسوجات خانه", parent: "accessory", image: "/images/boho.jpg" },
];

/**
 * Where each product belongs after the restructure.
 * `from` is the category it is expected to be in *now* - a product that has
 * already been moved by hand in the admin panel is left exactly where it is.
 */
const MOVES = [
  { slug: "accessory-1", from: "accessory", to: "bathrobe" },
  { slug: "accessory-2", from: "accessory", to: "bathrobe" },

  { slug: "poncho-1", from: "poncho", to: "kids" },
  { slug: "poncho-5", from: "poncho", to: "kids" },
  { slug: "poncho-11", from: "poncho", to: "kids" },

  { slug: "kimono-robe", from: "bathrobe", to: "kimono" },

  { slug: "cotton-bedspread", from: "accessory", to: "home-textile" },
  { slug: "waterproof-mat-3", from: "waterproof-mat", to: "bags" },
  { slug: "accessory-5", from: "accessory", to: "bags" },
  { slug: "dyson-bag", from: "accessory", to: "bags" },

  { slug: "cherry-crochet-hat", from: "accessory", to: "hats" },
  { slug: "fedora-hat", from: "accessory", to: "hats" },
  { slug: "bucket-hat", from: "accessory", to: "hats" },
  { slug: "straw-hat", from: "accessory", to: "hats" },

  { slug: "accessory-3", from: "accessory", to: "bath-accessory" }, // هدبند کشی
  { slug: "accessory-4", from: "accessory", to: "bath-accessory" }, // کلاه حمام نخی
];

async function restructureCategories() {
  log("\n2) دسته‌بندی‌ها");

  for (const [sort, p] of PARENTS.entries()) {
    await db.category.upsert({
      where: { slug: p.slug },
      update: { nameFa: p.nameFa, sort, parentId: null, active: true },
      create: { slug: p.slug, nameFa: p.nameFa, image: p.image, sort, active: true },
    });
  }

  const parentIds = Object.fromEntries(
    (await db.category.findMany({ where: { slug: { in: PARENTS.map((p) => p.slug) } } }))
      .map((c) => [c.slug, c.id])
  );

  for (const [i, l] of LEAVES.entries()) {
    await db.category.upsert({
      where: { slug: l.slug },
      update: { nameFa: l.nameFa, parentId: parentIds[l.parent], sort: i, active: true },
      create: {
        slug: l.slug, nameFa: l.nameFa, image: l.image,
        parentId: parentIds[l.parent], sort: i, active: true,
      },
    });
  }
  log(`   ✓ ${PARENTS.length} گروه اصلی و ${LEAVES.length} زیرگروه`);

  const bySlug = Object.fromEntries(
    (await db.category.findMany()).map((c) => [c.slug, c])
  );

  let moved = 0;
  for (const m of MOVES) {
    const product = await db.product.findUnique({
      where: { slug: m.slug },
      include: { category: true },
    });
    if (!product) continue;
    if (product.category.slug !== m.from) continue; // already moved, or moved by hand
    const target = bySlug[m.to];
    if (!target) continue;
    await db.product.update({ where: { id: product.id }, data: { categoryId: target.id } });
    log(`   → ${product.nameFa} : ${product.category.nameFa} ← ${target.nameFa}`);
    moved++;
  }
  log(`   ✓ ${moved} محصول جابه‌جا شد`);

  // Products must hang off a leaf. A parent that has children but still holds
  // products directly would hide them from its own children's pages, so say so
  // loudly. (بچگانه has no children on purpose - it is itself a leaf.)
  for (const p of PARENTS) {
    if (!LEAVES.some((l) => l.parent === p.slug)) continue;
    const stranded = await db.product.count({ where: { category: { slug: p.slug } } });
    if (stranded > 0) {
      log(`   ⚠ ${stranded} محصول هنوز مستقیم زیر «${p.nameFa}» است — در پنل به یک زیرگروه منتقلشان کن`);
    }
  }
}

// ── 3. Per-product sizes ─────────────────────────────────────────────
const custom = (rangeLabel = "هر سایز و هر قدی — با هماهنگی") => ({
  label: "سایز سفارشی", rangeLabel, kind: "CUSTOM",
});

/** فری‌سایز for an adult wearable, with the real numbers from its description. */
const freeWear = (rangeLabel, fitFrom, fitTo, lengthCm) => ({
  label: "فری‌سایز", rangeLabel, kind: "FREE", fitFrom, fitTo, lengthCm,
});

const dims = (label, rangeLabel) => ({ label, rangeLabel });
const freeOne = (rangeLabel = "یک اندازه") => ({ label: "فری‌سایز", rangeLabel, kind: "FREE" });

const kidsRows = CHARTS.find((c) => c.key === "kids").rows.map((r) => ({
  label: r.label, rangeLabel: r.rangeLabel, kind: r.kind ?? "STANDARD",
  fitFrom: r.fitFrom ?? null, fitTo: r.fitTo ?? null,
  heightFrom: r.heightFrom ?? null, heightTo: r.heightTo ?? null,
}));

/**
 * The size rows each existing product gets.
 *
 * Where the product's own description states its real size - «فری سایز»,
 * «قد ۹۰ سانتی‌متر»، «مناسب برای سایز ۳۶ تا ۵۴»، «ابعاد ۴۵×۷۰» - those numbers
 * are used verbatim. Nothing is invented: a poncho the shop only ever cut one
 * width of gets فری‌سایز + سایز سفارشی, not a made-up XS–XXL range. When she
 * starts grading sizes, «الگوی سایزبندی» in the product form fills the full
 * table in one click.
 */
const SIZES = {
  // ── تن‌پوش، پانچو، رومایویی، کیمونو (adult) ──
  "bathrobe-1": [freeWear("۳۶–۵۴ · قد ۹۰ سانتی‌متر", 36, 54, 90), custom()],
  "bathrobe-2": [freeWear("۳۶–۵۶ · قد ۸۰ سانتی‌متر", 36, 56, 80), custom()],
  "kimono-robe": [freeWear("۳۶–۵۴ · با کمربند قابل تنظیم", 36, 54, null), custom()],
  "poncho-2": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-3": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-4": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-6": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-7": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-8": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-9": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "poncho-10": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "accessory-1": [freeWear("۳۶–۵۴", 36, 54, null), custom()],
  "accessory-2": [freeWear("۳۶–۵۴", 36, 54, null), custom()],

  // ── بچگانه - graded by the child's height ──
  "kids-1": kidsRows,
  "poncho-1": kidsRows,
  "poncho-5": kidsRows,
  "poncho-11": kidsRows,

  // ── حوله - dimensions, no body fit ──
  "hand-1": [dims("صورت", "۴۵×۴۵ سانتی‌متر")],
  "hand-2": [dims("دست و صورت", "۴۵×۷۰ سانتی‌متر")],
  "body-1": [dims("بدن و استخری", "۹۰×۱۷۰ سانتی‌متر")],
  "kitchen-1": [dims("آشپزخانه", "۳۰×۶۰ سانتی‌متر")],
  "kitchen-2": [dims("پک دو عددی", "۳۰×۶۰ سانتی‌متر — دو عدد")],

  // ── زیرانداز ──
  "beach-mat-1": [dims("ساحلی یک‌نفره", "۷۵×۱۷۰ سانتی‌متر"), custom("ابعاد بزرگ‌تر با هماهنگی")],
  "waterproof-mat-1": [dims("ضدآب", "۱۶۰×۲۰۰ سانتی‌متر"), custom("ابعاد بزرگ‌تر با هماهنگی")],
  "waterproof-mat-2": [dims("ضدآب", "۱۶۰×۲۰۰ سانتی‌متر"), custom("ابعاد بزرگ‌تر با هماهنگی")],

  // ── کیف، اکسسوری، روتختی ──
  "accessory-5": [dims("کیف و ارگانایزر", "۳۲×۲۲ سانتی‌متر")],
  "dyson-bag": [freeOne()],
  "waterproof-mat-3": [freeOne()],
  "cotton-bedspread": [dims("روتختی", "۱۸۰×۱۸۰ سانتی‌متر")],
  "accessory-3": [freeOne("کشی — مناسب سایزهای مختلف")],
  "accessory-4": [freeOne()],

  // ── کلاه - no estimator, so deliberately no fit range ──
  "cherry-crochet-hat": [freeOne("دور سر ۵۵–۵۹")],
  "fedora-hat": [freeOne("دور سر ۵۵–۵۹")],
  "straw-hat": [freeOne("دور سر ۵۵–۵۹")],
  "bucket-hat": [{ label: "مدیوم", rangeLabel: "دور سر ۵۶–۵۸" }],
};

async function backfillSizes() {
  log("\n3) سایزهای محصولات");
  const products = await db.product.findMany({ include: { sizes: true } });
  let touched = 0;
  let skipped = 0;
  const missing = [];

  for (const p of products) {
    if (p.sizes.length > 0) {
      skipped++;
      continue; // already has sizes - never overwrite what she has edited
    }
    const rows = SIZES[p.slug];
    if (!rows) {
      missing.push(p.slug);
      continue;
    }

    await db.productSize.createMany({
      data: rows.map((r, i) => ({
        productId: p.id,
        label: r.label,
        rangeLabel: r.rangeLabel ?? "",
        kind: r.kind ?? "STANDARD",
        // nothing on the site changes price until she edits a size
        price: p.price,
        salePrice: p.salePrice && p.salePrice > 0 ? p.salePrice : null,
        // سایز سفارشی is never sold online, so it holds no stock
        stock: (r.kind ?? "STANDARD") === "CUSTOM" ? 0 : p.stock,
        lengthCm: r.lengthCm ?? null,
        fitFrom: r.fitFrom ?? null,
        fitTo: r.fitTo ?? null,
        heightFrom: r.heightFrom ?? null,
        heightTo: r.heightTo ?? null,
        sort: i,
      })),
    });

    // Product.stock is the sum of its sizes from here on
    const sizes = await db.productSize.findMany({ where: { productId: p.id } });
    const total = sizes.reduce((s, r) => s + r.stock, 0);
    await db.product.update({ where: { id: p.id }, data: { stock: total } });

    const buyable = rows.filter((r) => (r.kind ?? "STANDARD") !== "CUSTOM").length;
    if (total !== p.stock) {
      log(`   ✓ ${p.nameFa} — ${rows.length} سایز · موجودی ${p.stock} → ${total} (${buyable} سایز فروشی)`);
    } else {
      log(`   ✓ ${p.nameFa} — ${rows.length} سایز · موجودی ${total}`);
    }
    touched++;
  }

  log(`   ✓ ${touched} محصول سایزدار شد، ${skipped} از قبل سایز داشت`);
  if (missing.length) {
    log(`   ⚠ بدون سایز ماندند (در پنل اضافه کن): ${missing.join(", ")}`);
  }
}

// ── 4. Small data fixes ──────────────────────────────────────────────
async function dataFixes() {
  log("\n4) اصلاح داده");
  const zeroSale = await db.product.findMany({ where: { salePrice: 0 } });
  for (const p of zeroSale) {
    await db.product.update({ where: { id: p.id }, data: { salePrice: null } });
    log(`   ✓ ${p.nameFa} — قیمت حراج ۰ حذف شد`);
  }
  const zeroSizeSale = await db.productSize.updateMany({
    where: { salePrice: 0 },
    data: { salePrice: null },
  });
  if (zeroSizeSale.count) log(`   ✓ ${zeroSizeSale.count} سایز با قیمت حراج ۰ اصلاح شد`);
  if (!zeroSale.length && !zeroSizeSale.count) log("   · چیزی برای اصلاح نبود");
}

// ── 5. Homepage slots ────────────────────────────────────────────────
async function seedHomepage() {
  log("\n5) بخش‌های صفحه اصلی");

  const addAll = async (slot, ids) => {
    const already = await db.homeFeature.count({ where: { slot } });
    if (already > 0) {
      log(`   · ${slot} — از قبل ${already} محصول دارد، دست نخورد`);
      return;
    }
    for (const [sort, productId] of ids.entries()) {
      await db.homeFeature.create({ data: { slot, productId, sort } });
    }
    log(`   ✓ ${slot} — ${ids.length} محصول`);
  };

  // SHOWCASE keeps showing exactly what it shows today: the `featured` products
  const featured = await db.product.findMany({
    where: { featured: true, active: true },
    orderBy: { createdAt: "asc" },
    take: 8,
  });
  await addAll("SHOWCASE", featured.map((p) => p.id));

  // POPULAR replaces «پرفروش‌های موآی», which auto-picked the biggest discounts
  const all = await db.product.findMany({ where: { active: true } });
  const pct = (p) => 1 - p.salePrice / p.price;
  const discounted = all
    .filter((p) => p.salePrice && p.salePrice > 0 && p.salePrice < p.price)
    .sort((a, b) => pct(b) - pct(a))
    .slice(0, 4);
  await addAll("POPULAR", discounted.map((p) => p.id));

  // SPECIAL - «فقط چند عدد از هرکدام…», so genuinely short-run pieces
  const scarce = all
    .filter((p) => p.stock > 0 && p.stock <= 3)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 4);
  await addAll("SPECIAL", scarce.map((p) => p.id));
}

// ── run ──────────────────────────────────────────────────────────────
try {
  await seedCharts();
  await restructureCategories();
  await backfillSizes();
  await dataFixes();
  await seedHomepage();
  log("\n✓ همه‌چیز آماده است.\n");
} finally {
  await db.$disconnect();
}
