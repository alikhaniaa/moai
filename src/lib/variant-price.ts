/**
 * The pricing arithmetic, with no database behind it.
 *
 * A product carries the base money; a size and a colour each say only what they
 * ADD to it. Everything in this file is a pure function of its arguments, which
 * is what lets `tools/colortest.mjs` import and check the sums directly instead
 * of inferring them from an order total.
 *
 * `src/lib/pricing.ts` re-exports all of it, so callers keep importing from
 * there and never need to know this split exists.
 */

export type CampaignLike = {
  id: string;
  title: string;
  percent: number;
  scope: string;
  categoryId: string | null;
  productId: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type PricedProduct = {
  price: number; // list price (Toman)
  final: number; // what the buyer actually pays
  percent: number; // 0 when there is no discount
  campaignTitle: string | null; // set when a campaign (not a manual sale price) won
};

/** The identity and the base money every variant price is built on. */
export type ProductBase = {
  id: string;
  categoryId: string;
  price: number;
  salePrice: number | null;
};

/** The bits of a size row the pricing layer cares about. */
export type SizeLike = {
  id: string;
  label: string;
  kind: string; // STANDARD | FREE | CUSTOM
  /** Toman added to the product's base price. May be negative. */
  priceDelta: number;
  /** Optional absolute override, left over from before sizes were deltas. */
  salePrice: number | null;
  stock: number;
  active: boolean;
};

/** The bits of a colour row the pricing layer cares about. */
export type ColorLike = {
  id: string;
  nameFa: string;
  hex: string;
  priceDelta: number;
  active: boolean;
  /** the product photo that shows this colourway, when one is assigned */
  image?: string | null;
};

/** سایز سفارشی is quoted by hand - it can never be bought online. */
export const isBuyable = (s: SizeLike) => s.active && s.kind !== "CUSTOM";

/**
 * Colours a buyer may actually pick. The «رنگ‌بندی» switch wins over the rows:
 * turning it off retires the colourway for a season without losing its price.
 */
export const liveColors = (p: { colorsEnabled?: boolean; colors?: ColorLike[] | null }) =>
  p.colorsEnabled ? (p.colors ?? []).filter((c) => c.active) : [];

const appliesTo = (c: CampaignLike, productId: string, categoryId: string) =>
  c.scope === "SITE" ||
  (c.scope === "CATEGORY" && c.categoryId === categoryId) ||
  (c.scope === "PRODUCT" && c.productId === productId);

/**
 * Resolve what a product actually costs.
 *
 * A product can be discounted two ways at once - a manual salePrice and one or
 * more campaigns. They are never stacked: the buyer simply gets the lowest
 * price, which is both the fairest reading and the safest for the shop.
 */
export function priceOf(
  product: { id: string; categoryId: string; price: number; salePrice: number | null },
  campaigns: CampaignLike[]
): PricedProduct {
  let final = product.price;
  let campaignTitle: string | null = null;

  if (product.salePrice && product.salePrice < final) {
    final = product.salePrice;
  }

  for (const c of campaigns) {
    if (!appliesTo(c, product.id, product.categoryId)) continue;
    const pct = Math.min(90, Math.max(1, c.percent));
    const candidate = Math.round((product.price * (100 - pct)) / 100);
    if (candidate < final) {
      final = candidate;
      campaignTitle = c.title;
    }
  }

  return {
    price: product.price,
    final,
    percent: final < product.price ? Math.round((1 - final / product.price) * 100) : 0,
    campaignTitle,
  };
}

/**
 * List and sale price of one exact variant, before campaigns.
 *
 * The product carries the base money; a size and a colour each only say what
 * they ADD to it, so the two stack the way the shop expects - «XXL در قرمز» is
 * the base plus both surcharges.
 *
 * `size.salePrice` is the one absolute left over from before sizes were deltas.
 * Where it is set it replaces the sale price for that size, and the colour
 * surcharge still lands on top of it: a dearer colour is dearer on sale too.
 */
export function composeVariant(
  product: ProductBase,
  size: SizeLike | null,
  color: ColorLike | null
): { price: number; salePrice: number | null } {
  const sizeDelta = size?.priceDelta ?? 0;
  const colorDelta = color?.priceDelta ?? 0;

  const price = Math.max(0, product.price + sizeDelta + colorDelta);

  let sale: number | null = null;
  if (size?.salePrice != null) sale = size.salePrice + colorDelta;
  else if (product.salePrice != null) sale = product.salePrice + sizeDelta + colorDelta;

  return { price, salePrice: sale === null ? null : Math.max(0, sale) };
}

/** The full rules for one exact variant: compose the money, then discount it. */
export function priceOfVariant(
  product: ProductBase,
  size: SizeLike | null,
  color: ColorLike | null,
  campaigns: CampaignLike[]
): PricedProduct {
  return priceOf({ ...product, ...composeVariant(product, size, color) }, campaigns);
}

/** Back-compat shim for the callers that only ever deal in sizes. */
export const priceOfSize = (
  product: ProductBase,
  size: SizeLike,
  campaigns: CampaignLike[]
) => priceOfVariant(product, size, null, campaigns);

/**
 * The cheapest colour is simply the smallest surcharge: a colour adds the same
 * constant to the list price and to the sale price, and a campaign percentage
 * is monotonic, so the smallest delta always wins. That saves walking every
 * size x colour pair on a listing page.
 */
const cheapestColor = (colors: ColorLike[]): ColorLike | null =>
  colors.length === 0 ? null : colors.reduce((a, b) => (b.priceDelta < a.priceDelta ? b : a));

/**
 * What a product costs on a listing card - the cheapest thing a buyer could
 * actually walk away with. Once it has sizes the cheapest buyable size is the
 * honest headline; the product's own price is only the fallback for products
 * that were never given sizes.
 */
export function priceOfListing(
  p: ProductBase & {
    sizes?: SizeLike[] | null;
    colors?: ColorLike[] | null;
    colorsEnabled?: boolean;
  },
  campaigns: CampaignLike[]
): PricedProduct {
  const color = cheapestColor(liveColors(p));
  const buyable = (p.sizes ?? []).filter(isBuyable);
  if (buyable.length === 0) return priceOfVariant(p, null, color, campaigns);

  return buyable
    .map((s) => priceOfVariant(p, s, color, campaigns))
    .reduce((a, b) => (b.final < a.final ? b : a));
}

/**
 * Shape a product for the storefront. The campaign-adjusted price is written
 * into `salePrice`, so every existing badge / strikethrough in the UI reflects
 * campaigns without any component needing to know they exist.
 */
export function toCard(
  p: ProductBase & {
    slug: string;
    nameFa: string;
    image: string;
    category?: { nameFa: string } | null;
    sizes?: SizeLike[] | null;
    colors?: ColorLike[] | null;
    colorsEnabled?: boolean;
  },
  campaigns: CampaignLike[]
) {
  const { price, final } = priceOfListing(p, campaigns);
  // more than one buyable size ⇒ the buyer must choose one on the product page
  const buyable = (p.sizes ?? []).filter(isBuyable);
  return {
    id: p.id,
    slug: p.slug,
    nameFa: p.nameFa,
    price,
    salePrice: final < price ? final : null,
    image: p.image,
    categoryName: p.category?.nameFa,
    sizeCount: buyable.length,
    colorCount: liveColors(p).length,
  };
}

// ── The cart ─────────────────────────────────────────────────────────

/** A cart line as the browser sends it. Prices are never accepted from here. */
export type CartInput = {
  id: string;
  qty: number;
  sizeId?: string | null;
  colorId?: string | null;
};

export type PricedLine = {
  product: { id: string; nameFa: string; stock: number; categoryId: string };
  size: SizeLike | null;
  color: ColorLike | null;
  qty: number;
  unitPrice: number;
  /** Stock that actually limits this line - the size row's when there is one. */
  stock: number;
  sizeLabel: string | null;
  colorName: string | null;
};

/** A line the server refuses to sell, with the reason the buyer is shown. */
export type BlockedLine = {
  nameFa: string;
  reason: "CUSTOM" | "NEEDS_SIZE" | "NEEDS_COLOR";
};

/** The Persian sentence for a refused line. */
export const blockedMessage = (b: BlockedLine) =>
  b.reason === "CUSTOM"
    ? `«${b.nameFa}» با سایز سفارشی آنلاین ثبت نمی‌شود — برای هماهنگی در واتس‌اپ پیام بده.`
    : b.reason === "NEEDS_COLOR"
      ? `برای «${b.nameFa}» باید رنگ را انتخاب کنی.`
      : `برای «${b.nameFa}» باید سایز را انتخاب کنی.`;

/**
 * The `where` that selects live campaigns. It lives here, next to the rules it
 * serves, but it is only a plain object - the query itself belongs to
 * `pricing.ts`, which is the half that may touch the database.
 */
export const getActiveCampaignsFilter = (now: Date) => ({
  active: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ],
});
