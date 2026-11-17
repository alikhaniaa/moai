import { db } from "./db";

/**
 * Sizes and colours are both "the base price, plus this much".
 *
 * `ProductSize.price` is no longer read when pricing anything - the base and
 * the delta are - but the column is kept in step so it can never contradict the
 * app for anything reading the database directly (a backup, a report, the SQL
 * console). Call this after ANY change to `Product.price` or to a size's delta.
 *
 * سایز سفارشی is never sold online, so it stays pinned at 0/0 rather than
 * carrying a large negative delta the shop would then see in the form.
 */
export async function syncVariantPrices(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { sizes: true },
  });
  if (!product) return;

  for (const s of product.sizes) {
    const price = s.kind === "CUSTOM" ? 0 : Math.max(0, product.price + s.priceDelta);
    const delta = s.kind === "CUSTOM" ? 0 : s.priceDelta;
    if (s.price !== price || s.priceDelta !== delta) {
      await db.productSize.update({ where: { id: s.id }, data: { price, priceDelta: delta } });
    }
  }
}

/** The global colour palette («جدول رنگ‌ها»), for the product form's picker. */
export async function getColorPresets() {
  return db.colorPreset.findMany({
    where: { active: true },
    orderBy: [{ sort: "asc" }, { nameFa: "asc" }],
  });
}

/**
 * A hex the browser will actually accept as a swatch. The shop types these by
 * hand, so anything that isn't `#rgb`/`#rrggbb` falls back to a neutral grey
 * rather than reaching the page as a broken (or injected) style value.
 */
export function safeHex(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  if (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  return "#cccccc";
}
