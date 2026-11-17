import { db } from "./db";
import { toCard, type CampaignLike } from "./pricing";
import type { ProductCardData } from "@/components/ProductCard";

/** The three curated homepage sections, in the order they appear on the page. */
export const HOME_SLOTS = [
  {
    slot: "SHOWCASE",
    nameFa: "ویترین بالای صفحه",
    prefix: "homeShowcase",
    note: "نوار محصولاتی که با اسکرول افقی حرکت می‌کند — درست بعد از تصویر بالای صفحه.",
  },
  {
    slot: "SPECIAL",
    nameFa: "نسخه محدود",
    prefix: "homeSpecial",
    note:
      "فقط محصول اول این فهرست روی صفحه اصلی نشان داده می‌شود — یک عکس بزرگ با نوار «نسخه محدود» روی آن. بقیه‌ی محصولات این فهرست پشت دکمه‌ی «همه‌ی نسخه‌های محدود» جمع می‌شوند.",
  },
  {
    slot: "POPULAR",
    nameFa: "محبوب‌ترین",
    prefix: "homePopular",
    note: "ردیف محصولات، بعد از بخش نسخه محدود.",
  },
] as const;

export type HomeSlot = (typeof HOME_SLOTS)[number]["slot"];

const include = { category: true, sizes: true, colors: true } as const;

/**
 * The products the shop owner picked for each slot, in her order.
 *
 * Inactive products are dropped rather than shown as dead links - hiding a
 * product in محصولات should be enough, without also having to remember to
 * unpick it here.
 */
export async function getHomeFeatures(
  campaigns: CampaignLike[]
): Promise<Record<HomeSlot, ProductCardData[]>> {
  const rows = await db.homeFeature.findMany({
    orderBy: { sort: "asc" },
    include: { product: { include } },
  });

  const out = { SHOWCASE: [], POPULAR: [], SPECIAL: [] } as Record<HomeSlot, ProductCardData[]>;
  for (const r of rows) {
    if (!r.product.active) continue;
    const bucket = out[r.slot as HomeSlot];
    if (bucket) bucket.push(toCard(r.product, campaigns));
  }
  return out;
}

/**
 * The pinned showcase falls back to whatever is flagged `featured` while the
 * curated list is still empty, so the section is never blank on a fresh shop.
 */
export async function getShowcaseFallback(campaigns: CampaignLike[]): Promise<ProductCardData[]> {
  const featured = await db.product.findMany({
    where: { featured: true, active: true },
    include,
    orderBy: { createdAt: "asc" },
  });
  return featured.map((p) => toCard(p, campaigns));
}

/**
 * The نسخه محدود collection: the products the shop pinned to that slot, in her
 * order. The first is the one shown big on the home page; the whole list is
 * what /products?limited=1 shows.
 */
export async function getLimitedEditionIds(): Promise<string[]> {
  const rows = await db.homeFeature.findMany({
    where: { slot: "SPECIAL" },
    orderBy: { sort: "asc" },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}
