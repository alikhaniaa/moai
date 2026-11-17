import { db } from "./db";
import {
  getActiveCampaignsFilter,
  isBuyable,
  liveColors,
  priceOfVariant,
  type CartInput,
  type CampaignLike,
  type ColorLike,
  type PricedLine,
  type BlockedLine,
  type SizeLike,
} from "./variant-price";

/**
 * The database-facing half of pricing. All the arithmetic lives in
 * `./variant-price`, which has no database behind it so the test suite can
 * import and check the sums directly - everything is re-exported here, so every
 * caller keeps importing from `@/lib/pricing` exactly as before.
 */
export * from "./variant-price";

/** Campaigns that are switched on and inside their date window right now. */
export async function getActiveCampaigns(): Promise<CampaignLike[]> {
  return db.campaign.findMany({ where: getActiveCampaignsFilter(new Date()) });
}

/**
 * Server-side authority for what a cart costs - never trust client prices.
 *
 * With sizes and colours in play the browser also can't be trusted about *what*
 * it is buying: a سایز سفارشی line, or a line missing a choice the product
 * actually offers, is refused here rather than quietly repriced.
 */
export async function priceCart(items: CartInput[]) {
  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    include: {
      sizes: { orderBy: { sort: "asc" } },
      colors: { orderBy: { sort: "asc" } },
    },
  });
  const campaigns = await getActiveCampaigns();
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  const blocked: BlockedLine[] = [];

  for (const item of items) {
    const p = byId.get(item.id);
    if (!p || !p.active) continue;
    const qty = Math.max(1, Math.min(20, Number(item.qty) || 1));
    const buyable = p.sizes.filter(isBuyable);

    let size: SizeLike | null = null;
    if (item.sizeId) {
      const found = p.sizes.find((s) => s.id === item.sizeId);
      if (!found || !found.active) continue; // stale line from an old cart
      if (found.kind === "CUSTOM") {
        blocked.push({ nameFa: p.nameFa, reason: "CUSTOM" });
        continue;
      }
      size = found;
    } else if (buyable.length === 1) {
      // one size only - nothing for the buyer to choose, so choose it for them
      size = buyable[0];
    } else if (buyable.length > 1) {
      blocked.push({ nameFa: p.nameFa, reason: "NEEDS_SIZE" });
      continue;
    }

    // Colours follow exactly the same rules, so a product offering three
    // colourways can never be bought without saying which one.
    const offered = liveColors(p);
    let color: ColorLike | null = null;
    if (item.colorId) {
      const found = offered.find((c) => c.id === item.colorId);
      if (!found) continue; // retired or switched off since the cart was filled
      color = found;
    } else if (offered.length === 1) {
      color = offered[0];
    } else if (offered.length > 1) {
      blocked.push({ nameFa: p.nameFa, reason: "NEEDS_COLOR" });
      continue;
    }

    const { final } = priceOfVariant(p, size, color, campaigns);
    lines.push({
      product: p,
      size,
      color,
      qty,
      unitPrice: final,
      stock: size ? size.stock : p.stock,
      sizeLabel: size ? size.label : null,
      colorName: color ? color.nameFa : null,
    });
  }

  const goods = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return { lines, goods, blocked };
}
