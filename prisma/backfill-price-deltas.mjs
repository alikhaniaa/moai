/**
 * One-time migration: turn every size's absolute price into a delta on the
 * product's base price.
 *
 *     priceDelta = ProductSize.price − Product.price
 *
 * Two refinements on top of that, both provably price-neutral:
 *
 *   · سایز سفارشی has always stored `price: 0` because it is never sold online.
 *     Turning that into a delta would write a huge negative number the shop
 *     would then see in the form, so those rows are pinned at 0/0.
 *
 *   · Where EVERY buyable size of a product shares the same non-zero delta - 
 *     which happens when the base price was raised without the sizes following
 * - that delta is folded into the base instead, so the shop sees a clean
 *     row of zeros rather than «−۱٬۷۰۰٬۰۰۰» seven times. Folding shifts
 *     `Product.price` and `Product.salePrice` by the same amount and takes it
 *     back out of every delta, so what the buyer pays does not move.
 *
 * Nothing here is trusted: the check at the end re-derives what each row would
 * cost, list price AND sale price, and refuses the whole migration if any of
 * them differs by a single Toman from what it costs today.
 *
 * Safe to run repeatedly - a second run finds everything already correct.
 *
 * Run AFTER `prisma db push` and BEFORE reloading the app, so the new code
 * never serves a row whose delta is still the default 0.
 *
 *     node prisma/backfill-price-deltas.mjs --check   # plan + verify, no writes
 *     node prisma/backfill-price-deltas.mjs           # apply
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const checkOnly = process.argv.includes("--check");
const n = (v) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US"));

const products = await db.product.findMany({ include: { sizes: true } });

// ── 1. what every row costs TODAY, captured before anything is written ──────
//
// This is the old model's answer: for a sized product the size row carried the
// whole price and `Product.salePrice` was not consulted at all.
const before = new Map(); // sizeId → { list, sale }
for (const p of products) {
  for (const s of p.sizes) {
    if (s.kind === "CUSTOM") continue;
    before.set(s.id, { list: s.price, sale: s.salePrice });
  }
}

// ── 2. the plan ────────────────────────────────────────────────────────────
const plan = []; // { product: {id, price, salePrice}, sizes: [{id, priceDelta, price}] }

for (const p of products) {
  // Only sizes the shop actually SELLS may steer the base price. An inactive
  // row is not on offer, so folding its delta would move the price of a product
  // whose page falls back to the base - a real price change nobody asked for.
  const buyable = p.sizes.filter((s) => s.active && s.kind !== "CUSTOM");
  const deltas = buyable.map((s) => s.price - p.price);

  // fold a delta the whole product shares back into the base price
  let fold = 0;
  if (buyable.length > 0 && deltas.every((d) => d === deltas[0]) && deltas[0] !== 0) {
    const candidateBase = p.price + deltas[0];
    const candidateSale = p.salePrice === null ? null : p.salePrice + deltas[0];
    if (candidateBase > 0 && (candidateSale === null || candidateSale >= 0)) fold = deltas[0];
  }

  plan.push({
    product: {
      id: p.id,
      nameFa: p.nameFa,
      price: p.price + fold,
      salePrice: p.salePrice === null ? null : p.salePrice + fold,
      folded: fold,
      wasPrice: p.price,
    },
    sizes: p.sizes.map((s) => ({
      id: s.id,
      label: s.label,
      kind: s.kind,
      priceDelta: s.kind === "CUSTOM" ? 0 : s.price - p.price - fold,
      price: s.kind === "CUSTOM" ? 0 : s.price,
    })),
  });
}

// ── 3. verify the plan against what the shop charges today ─────────────────
const wrong = [];
for (const entry of plan) {
  for (const s of entry.sizes) {
    if (s.kind === "CUSTOM") {
      if (s.price !== 0 || s.priceDelta !== 0) wrong.push(`${entry.product.nameFa} / ${s.label}: سایز سفارشی must stay 0/0`);
      continue;
    }
    const was = before.get(s.id);
    const listAfter = entry.product.price + s.priceDelta;
    // the new model: a per-size override still wins, otherwise the product's
    // own sale price carries the delta
    const saleAfter =
      was.sale !== null ? was.sale : entry.product.salePrice === null ? null : entry.product.salePrice + s.priceDelta;

    if (listAfter !== was.list) {
      wrong.push(`${entry.product.nameFa} / ${s.label}: list ${n(was.list)} → ${n(listAfter)}`);
    }
    if ((was.sale ?? null) !== (saleAfter ?? null)) {
      wrong.push(`${entry.product.nameFa} / ${s.label}: sale ${n(was.sale)} → ${n(saleAfter)}`);
    }
  }
}

// ── 3b. the headline price of every product must not move either ───────────
//
// Per-row prices holding still is not enough: what a shopper sees on the card
// and at the top of the product page is the CHEAPEST size actually on offer, or
// the product's own price when nothing is. Folding a delta into the base moves
// that fallback, so it gets its own check.
const campaigns = await db.campaign.findMany({
  where: {
    active: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
    ],
  },
});
const applies = (c, pid, cid) =>
  c.scope === "SITE" ||
  (c.scope === "CATEGORY" && c.categoryId === cid) ||
  (c.scope === "PRODUCT" && c.productId === pid);
const cheapest = (prod, list, sale) => {
  let final = list;
  if (sale && sale < final) final = sale;
  for (const c of campaigns) {
    if (!applies(c, prod.id, prod.categoryId)) continue;
    const pct = Math.min(90, Math.max(1, c.percent));
    const cand = Math.round((list * (100 - pct)) / 100);
    if (cand < final) final = cand;
  }
  return final;
};

for (const entry of plan) {
  const p = products.find((x) => x.id === entry.product.id);
  const onOffer = p.sizes.filter((s) => s.active && s.kind !== "CUSTOM");

  const headlineBefore = onOffer.length
    ? Math.min(...onOffer.map((s) => cheapest(p, s.price, s.salePrice)))
    : cheapest(p, p.price, p.salePrice);

  const headlineAfter = onOffer.length
    ? Math.min(
        ...onOffer.map((s) => {
          const row = entry.sizes.find((r) => r.id === s.id);
          const list = entry.product.price + row.priceDelta;
          const sale =
            s.salePrice !== null
              ? s.salePrice
              : entry.product.salePrice === null
                ? null
                : entry.product.salePrice + row.priceDelta;
          return cheapest(p, list, sale);
        })
      )
    : cheapest(p, entry.product.price, entry.product.salePrice);

  if (headlineBefore !== headlineAfter) {
    wrong.push(`${entry.product.nameFa}: headline ${n(headlineBefore)} → ${n(headlineAfter)}`);
  }
}

const folded = plan.filter((e) => e.product.folded !== 0);
const moved = plan.flatMap((e) => e.sizes.filter((s) => s.priceDelta !== 0).map((s) => ({ e, s })));

console.log(`${products.length} products · ${before.size} buyable size rows\n`);

if (folded.length) {
  console.log(`${folded.length} product(s) had one delta shared by every size — folded into the base price:`);
  for (const e of folded) {
    console.log(
      `  ${e.product.nameFa.slice(0, 38).padEnd(40)} base ${n(e.product.wasPrice)} → ${n(e.product.price)} ` +
        `(every size was ${e.product.folded > 0 ? "+" : "−"}${n(Math.abs(e.product.folded))}, now 0)`
    );
  }
  console.log("");
}

if (moved.length) {
  console.log(`${moved.length} size(s) genuinely priced away from their product's base:`);
  for (const { e, s } of moved) {
    console.log(
      `  ${e.product.nameFa.slice(0, 32).padEnd(34)} ${s.label.padEnd(12)} ` +
        `${n(e.product.price)} ${s.priceDelta > 0 ? "+" : "−"} ${n(Math.abs(s.priceDelta))} = ${n(s.price)}`
    );
  }
  console.log("");
}

if (wrong.length) {
  console.error(`✗ ${wrong.length} row(s) would change price — NOTHING was written:`);
  for (const w of wrong.slice(0, 25)) console.error("  " + w);
  await db.$disconnect();
  process.exit(1);
}

console.log(`✓ every one of ${before.size} rows keeps the exact list price and sale price it has today`);

// ── 4. write ───────────────────────────────────────────────────────────────
if (checkOnly) {
  console.log("\n(--check: nothing written)");
  await db.$disconnect();
  process.exit(0);
}

let touched = 0;
for (const entry of plan) {
  if (entry.product.folded !== 0) {
    await db.product.update({
      where: { id: entry.product.id },
      data: { price: entry.product.price, salePrice: entry.product.salePrice },
    });
  }
  for (const s of entry.sizes) {
    await db.productSize.update({
      where: { id: s.id },
      data: { priceDelta: s.priceDelta, price: s.price },
    });
    touched++;
  }
}

// ── 5. read it back and prove it landed ────────────────────────────────────
const after = await db.product.findMany({ include: { sizes: true } });
const drift = [];
for (const p of after) {
  for (const s of p.sizes) {
    const expect = s.kind === "CUSTOM" ? 0 : p.price + s.priceDelta;
    if (expect !== s.price) drift.push(`${p.nameFa} / ${s.label}: ${n(p.price)} + ${n(s.priceDelta)} ≠ ${n(s.price)}`);
    if (s.kind !== "CUSTOM" && before.has(s.id) && s.price !== before.get(s.id).list) {
      drift.push(`${p.nameFa} / ${s.label}: price moved ${n(before.get(s.id).list)} → ${n(s.price)}`);
    }
  }
}

if (drift.length) {
  console.error(`\n✗ ${drift.length} row(s) drifted after writing — DO NOT reload the app:`);
  for (const d of drift.slice(0, 25)) console.error("  " + d);
  await db.$disconnect();
  process.exit(1);
}

console.log(`✓ wrote ${touched} size rows; re-read from the database and every one still resolves to its old price`);
await db.$disconnect();
