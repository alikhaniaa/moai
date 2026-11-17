/**
 * Give every adult wearable the full graded size set.
 *
 *   node prisma/regrade-wearables.mjs
 *
 * پانچو، حوله تن‌پوش و رومایویی و کیمونو start out with only فری‌سایز; this
 * expands them to the whole «پانچو، حوله تن‌پوش، رومایویی و کیمونو» chart - 
 * XS · S · M · L · XL · XXL · فری‌سایز · سایز سفارشی - so a buyer picks a real
 * size and the shop can price each one separately.
 *
 * The rows come from the SizeChart table, not from constants here, so renaming
 * a size or moving a body-range in «جدول سایزها» first and then running this
 * gives her sizes, not mine.
 *
 * Idempotent and non-destructive:
 *   · a size that already exists is matched BY LABEL and kept - its id, price,
 *     sale price, stock and length all survive, because an order line and a
 *     saved cart both point at that id
 *   · a size the admin added by hand and that isn't in the chart is left alone
 *   · only genuinely missing rows are created
 *
 * New rows are priced and stocked exactly like the product they belong to, so
 * nothing on the site changes price until she edits a size. That does mean the
 * stock total multiplies - see the note printed at the end.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** The categories whose products are body-fit garments. */
const WEARABLE_CATEGORIES = ["poncho", "bathrobe", "kimono"];
const CHART_KEY = "wearable";

const chart = await db.sizeChart.findUnique({
  where: { key: CHART_KEY },
  include: { rows: { where: { active: true }, orderBy: { sort: "asc" } } },
});
if (!chart) {
  console.error(`جدول «${CHART_KEY}» پیدا نشد — اول prisma/upgrade-sizes.mjs را اجرا کن.`);
  process.exit(1);
}
console.log(`الگو: ${chart.nameFa} — ${chart.rows.length} ردیف\n`);

const products = await db.product.findMany({
  where: { category: { slug: { in: WEARABLE_CATEGORIES } } },
  include: { sizes: { orderBy: { sort: "asc" } }, category: true },
});

let touched = 0;
let created = 0;
const inflated = [];

for (const p of products) {
  const before = p.sizes.reduce((s, r) => s + r.stock, 0);
  const byLabel = new Map(p.sizes.map((s) => [s.label, s]));

  // a garment length already recorded on any row applies to the whole product
  const knownLength = p.sizes.find((s) => s.lengthCm != null)?.lengthCm ?? null;

  let added = 0;
  for (const [sort, row] of chart.rows.entries()) {
    const custom = row.kind === "CUSTOM";
    const existing = byLabel.get(row.label);

    if (existing) {
      // keep her numbers; only refresh what the chart is authoritative about
      await db.productSize.update({
        where: { id: existing.id },
        data: {
          kind: row.kind,
          fitFrom: row.fitFrom,
          fitTo: row.fitTo,
          heightFrom: row.heightFrom,
          heightTo: row.heightTo,
          sort,
          // سایز سفارشی is quoted by hand, so it carries no price at all
          ...(custom ? { price: 0, salePrice: null, stock: 0 } : {}),
        },
      });
      continue;
    }

    await db.productSize.create({
      data: {
        productId: p.id,
        label: row.label,
        rangeLabel: row.rangeLabel,
        kind: row.kind,
        price: custom ? 0 : p.price,
        salePrice: custom ? null : (p.salePrice && p.salePrice > 0 ? p.salePrice : null),
        stock: custom ? 0 : p.stock,
        lengthCm: custom ? null : knownLength,
        fitFrom: row.fitFrom,
        fitTo: row.fitTo,
        heightFrom: row.heightFrom,
        heightTo: row.heightTo,
        sort,
        active: true,
      },
    });
    added++;
    created++;
  }

  // Product.stock is the sum of its sizes
  const sizes = await db.productSize.findMany({ where: { productId: p.id } });
  const after = sizes.reduce((s, r) => s + r.stock, 0);
  await db.product.update({ where: { id: p.id }, data: { stock: after } });

  const sellable = sizes.filter((s) => s.kind !== "CUSTOM" && s.active).length;
  console.log(
    `   ${added ? "✓" : "·"} ${p.nameFa.slice(0, 46).padEnd(46)} ` +
      `${sizes.length} سایز (${sellable} فروشی) · موجودی ${before} → ${after}`
  );
  if (after !== before) inflated.push({ nameFa: p.nameFa, before, after });
  if (added) touched++;
}

console.log(`\n✓ ${touched} محصول سایزبندی شد، ${created} ردیف سایز اضافه شد`);

if (inflated.length) {
  console.log(
    `\n⚠ موجودی ${inflated.length} محصول چند برابر شد، چون هر سایز موجودیِ خودِ محصول را گرفت.`
  );
  console.log("   قبل از فروش، موجودی واقعی هر سایز را در «محصولات ← ویرایش» وارد کن:");
  for (const i of inflated) {
    console.log(`     · ${i.nameFa.slice(0, 46).padEnd(46)} ${i.before} → ${i.after}`);
  }
}
console.log();

await db.$disconnect();
