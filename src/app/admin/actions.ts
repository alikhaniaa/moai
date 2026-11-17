"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { pointsForOrder } from "@/lib/club";
import { getClubConfig } from "@/lib/club-data";
import { takeStock, returnStock, syncProductStock } from "@/lib/stock";
import { safeHex, syncVariantPrices } from "@/lib/variants";
import {
  update as snapppayUpdate,
  cancel as snapppayCancel,
  paymentStatus,
  tomanToRial,
} from "@/lib/snapppay-api";
import { snapppayItems, repriceOrder } from "@/lib/snapppay-cart";

async function guard() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin");
}

type OrderWithItems = { id: string; userId: string; total: number; couponId: string | null;
  status: string; paymentMethod: string; pointsAwarded: boolean; stockApplied: boolean;
  snapppayApprovedAt: Date | null;
  items: { productId: string; sizeId: string | null; qty: number }[] };

/**
 * The status a manually-confirmed order waits in, per payment method. An order
 * can only be approved out of exactly this status, which is what stops an
 * already-shipped or cancelled order being "approved" a second time.
 */
const MANUAL_WAITING: Record<string, string> = {
  SNAPPPAY: "AWAITING_SNAPPPAY",
  CARD: "AWAITING_TRANSFER",
};

/**
 * Confirming a manual order (اسنپ‌پی or کارت به کارت) does what the bank
 * callback does for a gateway order: club points, coupon usage, and - only if
 * it wasn't already reserved at checkout - the stock.
 *
 * Returns prisma operations so the caller runs them in ONE transaction, and
 * guards each side-effect behind the order's own once-only flags, so approving
 * twice (double click, or the status dropdown after the button) can't grant
 * points twice or take the same goods off the shelf again.
 */
async function manualApprovalOps(order: OrderWithItems) {
  const { pointsPer100k } = await getClubConfig();

  return [
    db.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        pointsAwarded: true,
        stockApplied: true,
        // SnappPay only: the instalment schedule the buyer sees counts from
        // this moment. A card transfer has no schedule, so it stays null.
        ...(order.paymentMethod === "SNAPPPAY"
          ? { snapppayApprovedAt: order.snapppayApprovedAt ?? new Date() }
          : {}),
      },
    }),
    ...(order.pointsAwarded
      ? []
      : [
          db.user.update({
            where: { id: order.userId },
            data: { points: { increment: pointsForOrder(order.total, pointsPer100k) } },
          }),
        ]),
    ...(order.stockApplied ? [] : takeStock(order.items)),
    ...(order.couponId && !order.pointsAwarded
      ? [db.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } })]
      : []),
  ];
}

/**
 * Admin confirms a manual payment - the SnappPay registration is done, or the
 * کارت به کارت receipt has been checked against the bank.
 */
export async function approveManualOrder(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return;
  // Only ever advances an order that is actually waiting for this confirmation.
  if (order.status !== MANUAL_WAITING[order.paymentMethod]) return;

  await db.$transaction(await manualApprovalOps(order));

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/transactions");
  revalidatePath("/account");
}

/** One row of the product form's «سایزها و قیمت‌ها» repeater. */
type SizeRow = {
  id?: string;
  label?: string;
  rangeLabel?: string;
  kind?: string;
  priceDelta?: unknown;
  salePrice?: unknown;
  stock?: unknown;
  lengthCm?: unknown;
  fitFrom?: unknown;
  fitTo?: unknown;
  heightFrom?: unknown;
  heightTo?: unknown;
  active?: boolean;
};

/** One row of the product form's «رنگ‌بندی» repeater. */
type ColorRow = {
  id?: string;
  nameFa?: string;
  hex?: unknown;
  priceDelta?: unknown;
  image?: unknown;
  active?: boolean;
};

const intOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === null || v === undefined || !Number.isFinite(n) ? null : Math.round(n);
};

/**
 * Write the size rows for a product.
 *
 * Rows are matched by id and *updated* rather than replaced, because an order
 * item and a saved cart line both point at a size id - recreating the rows on
 * every save would orphan them. Rows the admin removed are deleted; the rest
 * are updated in place, and `Product.stock` is re-derived from the result.
 *
 * A size stores what it ADDS to the base price. `price` is written alongside as
 * the resolved number purely so the column never contradicts the app; nothing
 * prices off it. See `syncVariantPrices()`.
 */
async function saveSizes(productId: string, rows: SizeRow[], basePrice: number) {
  const clean = rows
    .filter((r) => String(r.label ?? "").trim())
    .map((r, sort) => {
      const kind = ["STANDARD", "FREE", "CUSTOM"].includes(String(r.kind))
        ? String(r.kind)
        : "STANDARD";
      // سایز سفارشی is quoted by hand over WhatsApp, so it carries no price and
      // no stock at all - forced here so a stray number in the form can never
      // put a price on something that isn't for sale.
      const custom = kind === "CUSTOM";
      const priceDelta = custom ? 0 : intOrNull(r.priceDelta) ?? 0;
      return {
        id: typeof r.id === "string" && r.id ? r.id : null,
        label: String(r.label).trim(),
        rangeLabel: String(r.rangeLabel ?? "").trim(),
        kind,
        priceDelta,
        price: custom ? 0 : Math.max(0, basePrice + priceDelta),
        salePrice: custom ? null : intOrNull(r.salePrice),
        stock: custom ? 0 : Math.max(0, intOrNull(r.stock) ?? 0),
        lengthCm: intOrNull(r.lengthCm),
        fitFrom: intOrNull(r.fitFrom),
        fitTo: intOrNull(r.fitTo),
        heightFrom: intOrNull(r.heightFrom),
        heightTo: intOrNull(r.heightTo),
        sort,
        active: r.active !== false,
      };
    });

  const keep = clean.map((r) => r.id).filter((v): v is string => !!v);
  await db.productSize.deleteMany({
    where: { productId, ...(keep.length ? { id: { notIn: keep } } : {}) },
  });

  for (const row of clean) {
    const { id: rowId, ...data } = row;
    if (rowId) {
      // the id may be stale (row deleted in another tab) - fall back to create
      const exists = await db.productSize.findFirst({ where: { id: rowId, productId } });
      if (exists) {
        await db.productSize.update({ where: { id: rowId }, data });
        continue;
      }
    }
    await db.productSize.create({ data: { ...data, productId } });
  }

  await syncProductStock(productId);
}

/**
 * Write the colour rows for a product - same id-preserving rules as the sizes,
 * for the same reason: a colour id sits in saved carts and in past orders.
 *
 * Colours hold no stock, so nothing here touches inventory.
 */
async function saveColors(productId: string, rows: ColorRow[], images: string[]) {
  const clean = rows
    .filter((r) => String(r.nameFa ?? "").trim())
    .map((r, sort) => ({
      id: typeof r.id === "string" && r.id ? r.id : null,
      nameFa: String(r.nameFa).trim(),
      hex: safeHex(String(r.hex ?? "")),
      priceDelta: intOrNull(r.priceDelta) ?? 0,
      // only a photo this product actually has may be pinned to a colour
      image: images.includes(String(r.image ?? "")) ? String(r.image) : null,
      sort,
      active: r.active !== false,
    }));

  const keep = clean.map((r) => r.id).filter((v): v is string => !!v);
  await db.productColor.deleteMany({
    where: { productId, ...(keep.length ? { id: { notIn: keep } } : {}) },
  });

  for (const row of clean) {
    const { id: rowId, ...data } = row;
    if (rowId) {
      const exists = await db.productColor.findFirst({ where: { id: rowId, productId } });
      if (exists) {
        await db.productColor.update({ where: { id: rowId }, data });
        continue;
      }
    }
    await db.productColor.create({ data: { ...data, productId } });
  }
}

export async function saveProduct(formData: FormData) {
  await guard();

  const id = String(formData.get("id") ?? "");

  // images = ordered list from GalleryManager; first is the main photo, rest gallery
  let images: string[] = [];
  try {
    images = JSON.parse(String(formData.get("images") ?? "[]"));
  } catch {
    images = [];
  }
  images = images.filter((s) => typeof s === "string" && s.trim());

  const data = {
    nameFa: String(formData.get("nameFa") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-"),
    description: String(formData.get("description") ?? "").trim(),
    price: Math.max(0, Number(formData.get("price")) || 0),
    salePrice: formData.get("salePrice") ? Math.max(0, Number(formData.get("salePrice"))) : null,
    stock: Math.max(0, Number(formData.get("stock")) || 0),
    image: images[0] || "/images/spa.jpg",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
    categoryId: String(formData.get("categoryId") ?? ""),
    colorsEnabled: String(formData.get("colorsEnabled") ?? "0") === "1",
  };

  if (!data.nameFa || !data.slug || !data.categoryId || data.price <= 0) {
    redirect(`/admin/products${id ? `/${id}` : "/new"}?error=1`);
  }

  // slugs are unique; without this a repeated one threw a raw P2002 and the
  // shop lost the whole form to a broken page
  const slugOwner = await db.product.findUnique({ where: { slug: data.slug } });
  if (slugOwner && slugOwner.id !== id) {
    redirect(`/admin/products${id ? `/${id}` : "/new"}?error=slug`);
  }

  let sizeRows: SizeRow[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("sizes") ?? "[]"));
    if (Array.isArray(parsed)) sizeRows = parsed;
  } catch {
    sizeRows = [];
  }

  let colorRows: ColorRow[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("colors") ?? "[]"));
    if (Array.isArray(parsed)) colorRows = parsed;
  } catch {
    colorRows = [];
  }

  const gallery = images.slice(1); // everything after the main photo
  const prodId = id
    ? (await db.product.update({ where: { id }, data })).id
    : (await db.product.create({ data })).id;

  await saveSizes(prodId, sizeRows, data.price);
  await saveColors(prodId, colorRows, images);

  // replace the gallery rows with the current list
  await db.productImage.deleteMany({ where: { productId: prodId } });
  if (gallery.length) {
    await db.productImage.createMany({
      data: gallery.map((url, sort) => ({ productId: prodId, url, sort })),
    });
  }

  revalidatePath("/admin/products");
  revalidatePath("/size-guide");
  revalidatePath(`/admin/products/${prodId}`);
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const used = await db.orderItem.count({ where: { productId: id } });
  if (used > 0) {
    // keep history intact - just hide it from the shop. `active: false` is what
    // actually removes it from every listing; zero stock alone still shows it
    // as "sold out".
    await db.product.update({
      where: { id },
      data: { active: false, stock: 0, featured: false },
    });
  } else {
    await db.product.delete({ where: { id } });
  }
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function setOrderStatus(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  const allowed = ["AWAITING_PAYMENT", "AWAITING_SNAPPPAY", "AWAITING_TRANSFER", "PAID", "DISPATCHING", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (!id || !allowed.includes(status)) return;

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return;

  // Approving from this dropdown must do everything the approve button does - 
  // otherwise the buyer silently loses their club points for the order.
  if (status === "PAID" && order.status === MANUAL_WAITING[order.paymentMethod]) {
    await db.$transaction(await manualApprovalOps(order));
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    revalidatePath("/account");
    return;
  }

  // Cancelling a paid order has to put the goods back on the shelf, otherwise
  // the shop slowly "loses" stock it still owns.
  const returningStock = status === "CANCELLED" && order.stockApplied;

  await db.$transaction([
    db.order.update({
      where: { id },
      data: {
        status,
        trackingCode: trackingCode || null,
        ...(returningStock ? { stockApplied: false } : {}),
      },
    }),
    ...(returningStock ? returnStock(order.items) : []),
  ]);

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/account");
}

// ── Banners ─────────────────────────────────────────────────────
const dateOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Every slot the storefront can render; anything else would be invisible. */
const BANNER_SLOTS = ["HERO", "STRIP", "GRID", "STORY"];

export async function saveBanner(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const slot = String(formData.get("slot") ?? "STRIP");
  const data = {
    title: String(formData.get("title") ?? "").trim(),
    subtitle: String(formData.get("subtitle") ?? "").trim() || null,
    badge: String(formData.get("badge") ?? "").trim() || null,
    image: String(formData.get("image") ?? "").trim(),
    link: String(formData.get("link") ?? "").trim() || null,
    slot: BANNER_SLOTS.includes(slot) ? slot : "STRIP",
    sort: Number(formData.get("sort")) || 0,
    active: formData.get("active") === "on",
    startsAt: dateOrNull(formData.get("startsAt")),
    endsAt: dateOrNull(formData.get("endsAt")),
  };
  if (!data.title || !data.image) redirect("/admin/banners");

  if (id) await db.banner.update({ where: { id }, data });
  else await db.banner.create({ data });

  revalidatePath("/admin/banners");
  revalidatePath("/");
  redirect("/admin/banners");
}

export async function deleteBanner(formData: FormData) {
  await guard();
  await db.banner.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

export async function toggleBanner(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const b = await db.banner.findUnique({ where: { id } });
  if (b) await db.banner.update({ where: { id }, data: { active: !b.active } });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

// ── Campaigns (تخفیف‌ها) ─────────────────────────────────────────
export async function saveCampaign(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const scope = String(formData.get("scope") ?? "SITE");
  const data = {
    title: String(formData.get("title") ?? "").trim(),
    percent: Math.min(90, Math.max(1, Number(formData.get("percent")) || 0)),
    scope,
    categoryId: scope === "CATEGORY" ? String(formData.get("categoryId") ?? "") || null : null,
    productId: scope === "PRODUCT" ? String(formData.get("productId") ?? "") || null : null,
    active: formData.get("active") === "on",
    startsAt: dateOrNull(formData.get("startsAt")),
    endsAt: dateOrNull(formData.get("endsAt")),
  };
  if (!data.title || data.percent < 1) redirect("/admin/campaigns");

  if (id) await db.campaign.update({ where: { id }, data });
  else await db.campaign.create({ data });

  revalidatePath("/admin/campaigns");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/campaigns");
}

export async function deleteCampaign(formData: FormData) {
  await guard();
  await db.campaign.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/campaigns");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function toggleCampaign(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const c = await db.campaign.findUnique({ where: { id } });
  if (c) await db.campaign.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/campaigns");
  revalidatePath("/products");
  revalidatePath("/");
}

// ── Settings ────────────────────────────────────────────────────
export async function saveSettings(formData: FormData) {
  await guard();
  const entries = [...formData.entries()].filter(([k]) => k.startsWith("s_"));
  for (const [k, v] of entries) {
    const key = k.slice(2);
    // Landing content is validated by its dedicated actions, including photo checks.
    if (key.startsWith("landing")) continue;
    const value = String(v);
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  revalidatePath("/", "layout");

  // /admin/homepage edits its own section titles through this same action, so
  // it says where to come back to. Only admin paths - never an open redirect.
  const back = String(formData.get("redirectTo") ?? "");
  redirect(back.startsWith("/admin/") ? back : "/admin/settings?saved=1");
}

// ── Discount codes ──────────────────────────────────────────────
export async function saveCoupon(formData: FormData) {
  await guard();
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  // an unrecognised type would silently behave as PERCENT, so pin it here
  const rawType = String(formData.get("type") ?? "PERCENT");
  const type = rawType === "FIXED" ? "FIXED" : "PERCENT";
  const value = Math.max(1, Number(formData.get("value")) || 0);
  if (!code || value < 1) redirect("/admin/coupons?error=value");

  const id = String(formData.get("id") ?? "");

  // Codes are unique. Without this, saving a code that already exists threw a
  // raw P2002 out of the server action and the shop just saw a broken page - 
  // which is exactly what happened on 26 شهریور (digest 2259659709).
  const clash = await db.coupon.findUnique({ where: { code } });
  if (clash && clash.id !== id) redirect("/admin/coupons?error=duplicate");

  const phone = String(formData.get("phone") ?? "").trim();
  const owner = phone ? await db.user.findUnique({ where: { phone } }) : null;
  // A personal code whose owner can't be found must not quietly become public - 
  // that would hand a targeted discount to every visitor.
  if (phone && !owner) redirect("/admin/coupons?error=owner");

  const data = {
    code,
    type,
    value: type === "PERCENT" ? Math.min(90, value) : value,
    minSubtotal: Math.max(0, Number(formData.get("minSubtotal")) || 0),
    freeShipping: formData.get("freeShipping") === "on",
    // a non-numeric entry would reach Prisma as NaN and blow up the action
    maxUses: intOrNull(formData.get("maxUses")),
    allowInstallments: formData.get("blockInstallments") !== "on",
    perUserLimit: Math.max(0, Number(formData.get("perUserLimit")) || 1),
    userId: owner?.id ?? null,
    active: formData.get("active") === "on",
    startsAt: dateOrNull(formData.get("startsAt")),
    endsAt: dateOrNull(formData.get("endsAt")),
  };

  if (id) await db.coupon.update({ where: { id }, data });
  else await db.coupon.create({ data });

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons?saved=1");
}

export async function deleteCoupon(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const used = await db.order.count({ where: { couponId: id } });
  if (used > 0) {
    // keep the code on past orders - just stop it being usable again
    await db.coupon.update({ where: { id }, data: { active: false } });
  } else {
    await db.coupon.delete({ where: { id } });
  }
  revalidatePath("/admin/coupons");
}

export async function toggleCoupon(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const c = await db.coupon.findUnique({ where: { id } });
  if (c) await db.coupon.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/coupons");
}

// ── Shipping methods ────────────────────────────────────────────
export async function saveShipping(formData: FormData) {
  await guard();
  const data = {
    nameFa: String(formData.get("nameFa") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    cost: Math.max(0, Number(formData.get("cost")) || 0),
    freeFrom: Math.max(0, Number(formData.get("freeFrom")) || 0),
    estimatedDays: String(formData.get("estimatedDays") ?? "").trim() || null,
    sort: Number(formData.get("sort")) || 0,
    active: formData.get("active") === "on",
  };
  if (!data.nameFa) redirect("/admin/shipping");

  const id = String(formData.get("id") ?? "");
  if (id) await db.shippingMethod.update({ where: { id }, data });
  else await db.shippingMethod.create({ data });

  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
  redirect("/admin/shipping");
}

export async function deleteShipping(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const used = await db.order.count({ where: { shippingMethodId: id } });
  if (used > 0) {
    await db.shippingMethod.update({ where: { id }, data: { active: false } });
  } else {
    await db.shippingMethod.delete({ where: { id } });
  }
  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
}

// ── Members club ────────────────────────────────────────────────
export async function saveClubTier(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const data = {
    key: String(formData.get("key") ?? "").trim() || `tier-${Date.now()}`,
    nameFa: String(formData.get("nameFa") ?? "").trim(),
    emoji: String(formData.get("emoji") ?? "🐚").trim() || "🐚",
    minPoints: Math.max(0, Number(formData.get("minPoints")) || 0),
    perks: String(formData.get("perks") ?? "").trim(),
    sort: Number(formData.get("sort")) || 0,
  };
  if (!data.nameFa) redirect("/admin/club");
  if (id) await db.clubTier.update({ where: { id }, data });
  else await db.clubTier.create({ data });
  revalidatePath("/admin/club");
  revalidatePath("/club");
  redirect("/admin/club");
}

export async function deleteClubTier(formData: FormData) {
  await guard();
  await db.clubTier.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/club");
  revalidatePath("/club");
}

// ── Order fulfilment (status + Tipax tracking) ──────────────────
export async function setTracking(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const allowed = ["AWAITING_PAYMENT", "AWAITING_SNAPPPAY", "AWAITING_TRANSFER", "PAID", "DISPATCHING", "SHIPPED", "DELIVERED", "CANCELLED"];

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return;

  // Same guard as setOrderStatus: confirming a manual order from the status box
  // here must also grant points, not just flip the label.
  if (status === "PAID" && order.status === MANUAL_WAITING[order.paymentMethod]) {
    await db.$transaction([
      ...(await manualApprovalOps(order)),
      ...(trackingCode ? [db.order.update({ where: { id }, data: { trackingCode } })] : []),
    ]);
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    revalidatePath("/account");
    return;
  }

  // A tracking code advances a paid or dispatching order to SHIPPED unless
  // the admin explicitly selected a status.
  const newStatus = allowed.includes(status)
    ? status
    : trackingCode && ["PAID", "DISPATCHING"].includes(order.status)
      ? "SHIPPED"
      : order.status;

  const returningStock = newStatus === "CANCELLED" && order.stockApplied;

  await db.$transaction([
    db.order.update({
      where: { id },
      data: {
        trackingCode: trackingCode || null,
        status: newStatus,
        ...(returningStock ? { stockApplied: false } : {}),
      },
    }),
    ...(returningStock ? returnStock(order.items) : []),
  ]);

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/transactions");
  revalidatePath("/account");
}

// ── Bulk price editing ──────────────────────────────────────────
/** Apply a percentage change to every product in a category (or all of them). */
export async function bulkPriceChange(formData: FormData) {
  await guard();
  const categoryId = String(formData.get("categoryId") ?? "");
  const percent = Number(formData.get("percent")) || 0;
  const mode = String(formData.get("mode") ?? "sale"); // sale | list | clear

  const products = await db.product.findMany({
    where: categoryId ? { categoryId } : {},
    select: { id: true, price: true },
  });

  for (const p of products) {
    if (mode === "clear") {
      await db.product.update({ where: { id: p.id }, data: { salePrice: null } });
    } else if (mode === "sale") {
      const sale = Math.round((p.price * (100 - percent)) / 100);
      await db.product.update({ where: { id: p.id }, data: { salePrice: sale } });
    } else {
      const price = Math.max(1000, Math.round((p.price * (100 + percent)) / 100));
      await db.product.update({ where: { id: p.id }, data: { price } });
    }

    // A per-size sale price is an absolute override, so one left behind would
    // be the single size that ISN'T at the percentage the shop just asked for.
    // A bulk change is a statement about the whole catalogue, so the overrides
    // step aside and the product-level sale applies to every size uniformly.
    if (mode !== "list") {
      await db.productSize.updateMany({
        where: { productId: p.id, salePrice: { not: null } },
        data: { salePrice: null },
      });
    }

    // Sizes and colours are deltas on the base, so moving the base has already
    // moved all of them; this only rewrites the derived `price` column.
    await syncVariantPrices(p.id);
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products?bulk=1");
}

// ── جدول سایزها (global size presets) ───────────────────────────
export async function saveSizeChart(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const data = {
    key: String(formData.get("key") ?? "").trim().toLowerCase().replace(/\s+/g, "-"),
    nameFa: String(formData.get("nameFa") ?? "").trim(),
    intro: String(formData.get("intro") ?? "").trim(),
    col2Label: String(formData.get("col2Label") ?? "").trim(),
    col3Label: String(formData.get("col3Label") ?? "").trim(),
    sort: Number(formData.get("sort")) || 0,
    active: formData.get("active") === "on",
  };
  if (!data.nameFa || !data.key) redirect("/admin/sizes");

  if (id) await db.sizeChart.update({ where: { id }, data });
  else await db.sizeChart.create({ data });

  revalidatePath("/admin/sizes");
  revalidatePath("/size-guide");
  redirect("/admin/sizes");
}

export async function deleteSizeChart(formData: FormData) {
  await guard();
  await db.sizeChart.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/sizes");
  revalidatePath("/size-guide");
}

/**
 * Replace one chart's rows with the list from the repeater. Unlike a product's
 * sizes these are only a template - nothing points at a row id - so a plain
 * delete-and-recreate is both safe and simpler to reason about.
 */
export async function saveSizeChartRows(formData: FormData) {
  await guard();
  const chartId = String(formData.get("chartId") ?? "");
  if (!chartId) redirect("/admin/sizes");

  let rows: SizeRow[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    rows = [];
  }

  await db.sizeChartRow.deleteMany({ where: { chartId } });
  const clean = rows
    .filter((r) => String(r.label ?? "").trim())
    .map((r, sort) => ({
      chartId,
      label: String(r.label).trim(),
      rangeLabel: String(r.rangeLabel ?? "").trim(),
      extraLabel: String((r as { extraLabel?: string }).extraLabel ?? "").trim(),
      kind: ["STANDARD", "FREE", "CUSTOM"].includes(String(r.kind)) ? String(r.kind) : "STANDARD",
      fitFrom: intOrNull(r.fitFrom),
      fitTo: intOrNull(r.fitTo),
      heightFrom: intOrNull(r.heightFrom),
      heightTo: intOrNull(r.heightTo),
      lengthCm: intOrNull(r.lengthCm),
      sort,
      active: r.active !== false,
    }));
  if (clean.length) await db.sizeChartRow.createMany({ data: clean });

  revalidatePath("/admin/sizes");
  revalidatePath("/size-guide");
  redirect("/admin/sizes?saved=1");
}

// ── صفحه اصلی (curated homepage slots) ──────────────────────────
const SLOTS = ["SHOWCASE", "POPULAR", "SPECIAL"];

const refreshHome = () => {
  revalidatePath("/admin/homepage");
  revalidatePath("/");
};

export async function addHomeFeature(formData: FormData) {
  await guard();
  const slot = String(formData.get("slot") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!SLOTS.includes(slot) || !productId) return;

  const last = await db.homeFeature.findFirst({
    where: { slot },
    orderBy: { sort: "desc" },
  });
  // the unique [slot, productId] pair makes a double-click a no-op, not a dup
  await db.homeFeature
    .create({ data: { slot, productId, sort: (last?.sort ?? -1) + 1 } })
    .catch(() => {});
  refreshHome();
}

export async function removeHomeFeature(formData: FormData) {
  await guard();
  await db.homeFeature.delete({ where: { id: String(formData.get("id") ?? "") } }).catch(() => {});
  refreshHome();
}

/** Swap a pick with its neighbour - the ↑ ↓ buttons on /admin/homepage. */
export async function moveHomeFeature(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "up") === "up" ? -1 : 1;

  const row = await db.homeFeature.findUnique({ where: { id } });
  if (!row) return;

  const list = await db.homeFeature.findMany({
    where: { slot: row.slot },
    orderBy: { sort: "asc" },
  });
  const at = list.findIndex((r) => r.id === id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= list.length) return;

  // rewrite the whole slot's order: sort values from older edits need not be
  // contiguous, so swapping just two of them can leave the list unchanged
  const reordered = [...list];
  [reordered[at], reordered[to]] = [reordered[to], reordered[at]];
  await db.$transaction(
    reordered.map((r, sort) => db.homeFeature.update({ where: { id: r.id }, data: { sort } }))
  );
  refreshHome();
}

// ── دسته‌بندی‌ها ────────────────────────────────────────────────
export async function saveCategory(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  const data = {
    slug: String(formData.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-"),
    nameFa: String(formData.get("nameFa") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim() || null,
    sort: Number(formData.get("sort")) || 0,
    // a category can never be its own parent, which would hide it from every listing
    parentId: parentId === id ? null : parentId,
    active: formData.get("active") === "on",
  };
  if (!data.nameFa || !data.slug) redirect("/admin/categories");

  // same unique-slug trap as the coupon codes: tell the shop, do not crash
  const slugClash = await db.category.findUnique({ where: { slug: data.slug } });
  if (slugClash && slugClash.id !== id) redirect("/admin/categories?error=duplicate");

  if (id) await db.category.update({ where: { id }, data });
  else await db.category.create({ data });

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const [products, children] = await Promise.all([
    db.product.count({ where: { categoryId: id } }),
    db.category.count({ where: { parentId: id } }),
  ]);
  // deleting a category with products would orphan them, so hide it instead
  if (products > 0 || children > 0) {
    await db.category.update({ where: { id }, data: { active: false } });
  } else {
    await db.category.delete({ where: { id } });
  }
  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
}

// ── جدول رنگ‌ها (global colour palette) ─────────────────────────
//
// These are only a convenience for filling a product's colour rows: a product
// stores its own copy of the name, the swatch and the surcharge, so editing or
// deleting a preset never reaches a product that is already using it, and never
// touches a price.

export async function saveColorPreset(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const nameFa = String(formData.get("nameFa") ?? "").trim();
  if (!nameFa) redirect("/admin/colors");

  const data = {
    nameFa,
    hex: safeHex(String(formData.get("hex") ?? "")),
    sort: Math.max(0, Number(formData.get("sort")) || 0),
    active: formData.get("active") === "on",
  };

  if (id) await db.colorPreset.update({ where: { id }, data });
  else await db.colorPreset.create({ data });

  revalidatePath("/admin/colors");
  redirect("/admin/colors?saved=1");
}

export async function deleteColorPreset(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (id) await db.colorPreset.delete({ where: { id } });
  revalidatePath("/admin/colors");
  redirect("/admin/colors?saved=1");
}

// ── اسنپ‌پی: مرجوعی جزئی (update) و لغو کامل (cancel) ────────────

/**
 * `guard()` for the two actions that need to record WHO pressed the button.
 * اسنپ‌پی's update and cancel are irreversible and move real money, so every
 * call is written to PaymentOperation with the admin's name against it.
 */
async function guardAdmin() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin");
  return admin;
}

/**
 * Points to take back from a buyer on a refund, never more than they still
 * hold. A buyer who has already spent the points on a club perk would otherwise
 * end up with a negative balance, which nothing else in the club code expects.
 */
async function pointsToReclaim(userId: string, wanted: number) {
  if (wanted <= 0) return 0;
  const user = await db.user.findUnique({ where: { id: userId }, select: { points: true } });
  return Math.max(0, Math.min(user?.points ?? 0, wanted));
}

/**
 * The settled اسنپ‌پی attempt behind an order, or a reason there isn't one.
 *
 * Both follow-up services are only valid on a purchase that reached تسویه - 
 * SnappPay answers 1011 «وضعیت تراکنش معتبر نیست» otherwise (update and cancel
 * both require the SETTLE state). Checking here means the admin gets a Persian
 * sentence instead of a gateway error code.
 */
async function settledSnapppayPayment(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) return { error: "notfound" } as const;
  if (order.paymentMethod !== "SNAPPPAY_IPG") return { error: "notsnapppay" } as const;

  const payment = order.payments.find(
    (p) => p.provider === "SNAPPPAY" && p.status === "PAID" && p.token
  );
  if (!payment?.token) return { error: "nopayment" } as const;
  if (!payment.settledAt) return { error: "unsettled" } as const;

  return { order, payment, token: payment.token };
}

async function pendingCustomerRequest(requestId: string, orderId: string, kind: "UPDATE" | "CANCEL") {
  if (!requestId) return null;
  return db.snappPayChangeRequest.findFirst({
    where: { id: requestId, orderId, kind, status: "PENDING", pendingKey: orderId },
  });
}

/**
 * مرجوعی جزئی - the admin removes items or cuts quantities, and اسنپ‌پی refunds
 * the difference to the buyer's credit.
 *
 * The order of operations matters and is not negotiable: اسنپ‌پی is called
 * FIRST, and the shop's own records are only rewritten once it has agreed. The
 * call is irreversible, so a database write that happened before it would be a
 * refund the shop believes it gave and the buyer never received.
 *
 * Quantities may only go down. SnappPay refuses an update whose amount exceeds
 * the original (1042), and `repriceOrder` keeps the new total at or below the
 * old one by leaving shipping alone and clamping the coupon.
 */
export async function snapppayUpdateOrder(formData: FormData) {
  const admin = await guardAdmin();
  const id = String(formData.get("id") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  if (!id) return;

  const found = await settledSnapppayPayment(id);
  if ("error" in found) redirect(`/admin/orders/${id}?snapp=${found.error}`);
  const { order, payment, token } = found;

  const customerRequest = await pendingCustomerRequest(requestId, id, "UPDATE");
  if (requestId && !customerRequest) redirect(`/admin/orders/${id}?snapp=requestinvalid`);
  let requestedQty: Map<string, number> | null = null;
  if (customerRequest) {
    try {
      const parsed = JSON.parse(customerRequest.requestedItems) as Array<{ id?: unknown; qty?: unknown }>;
      if (!Array.isArray(parsed)) throw new Error("not an array");
      requestedQty = new Map(
        parsed
          .filter((row) => typeof row?.id === "string" && Number.isFinite(Number(row?.qty)))
          .map((row) => [String(row.id), Math.round(Number(row.qty))])
      );
      if (
        requestedQty.size !== order.items.length ||
        order.items.some((item) => !requestedQty?.has(item.id))
      ) {
        throw new Error("incomplete request");
      }
    } catch {
      redirect(`/admin/orders/${id}?snapp=requestinvalid`);
    }
  }

  // The form posts one `qty:<orderItemId>` per line; anything missing keeps its
  // current quantity, and a quantity may only fall.
  const lines = order.items.map((i) => {
    const raw = requestedQty ? requestedQty.get(i.id) : formData.get(`qty:${i.id}`);
    const asked = raw === null ? i.qty : Math.round(Number(raw) || 0);
    return { ...i, newQty: Math.max(0, Math.min(i.qty, asked)) };
  });

  const changed = lines.filter((l) => l.newQty !== l.qty);
  if (changed.length === 0) redirect(`/admin/orders/${id}?snapp=nochange`);
  if (lines.every((l) => l.newQty === 0)) redirect(`/admin/orders/${id}?snapp=emptycart`);

  const asOrderLines = lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    nameFa: l.nameFa,
    sizeLabel: l.sizeLabel,
    colorName: l.colorName,
    unitPrice: l.unitPrice,
    qty: l.newQty,
  }));

  const priced = repriceOrder(asOrderLines, {
    goodsTotal: order.goodsTotal,
    discount: order.discount,
    shippingCost: order.shippingCost,
  });

  // Belt and braces: the arithmetic above cannot raise the total, but sending a
  // higher amount would be refused by اسنپ‌پی anyway (1042) and is worth
  // catching here, where we can say why in Persian.
  if (priced.total > order.total) redirect(`/admin/orders/${id}?snapp=higher`);

  const result = await snapppayUpdate({
    paymentToken: token,
    mobile: order.phone,
    items: snapppayItems(asOrderLines),
    discountRial: tomanToRial(priced.discount),
    shippingRial: tomanToRial(priced.shippingCost),
  });

  const summary = changed
    .map((l) => (l.newQty === 0 ? `حذف ${l.nameFa}` : `${l.nameFa}: ${l.qty}→${l.newQty}`))
    .join("، ");

  if (!result.ok) {
    // A timeout is NOT a refusal. اسنپ‌پی may well have applied the change and
    // only the answer went missing, and there is no service that can tell us
    // afterwards - Get Payment Status reports the payment's state, which stays
    // SETTLE either way. Recording it as FAILED would tell the admin nothing
    // happened and invite a second refund, so it is recorded as unknown and the
    // admin is told to check with اسنپ‌پی before touching it again.
    const unresolved = result.timedOut === true;
    await db.paymentOperation.create({
      data: {
        paymentId: payment.id,
        kind: "UPDATE",
        status: unresolved ? "UNKNOWN" : "FAILED",
        code: result.code ?? null,
        amountRial: tomanToRial(priced.total),
        message: unresolved
          ? `${summary} — پاسخی از اسنپ‌پی نرسید. ممکن است تغییر اعمال شده باشد؛ پیش از تلاش دوباره با پشتیبانی اسنپ‌پی بررسی کنید.`
          : `${summary} — ${result.error}`,
        userId: admin.id,
        userName: admin.name ?? admin.phone,
      },
    });
    console.log(
      `[SNAPPPAY] order ${id} update ${unresolved ? "UNRESOLVED (timeout)" : "refused"}: ${result.error}`
    );
    redirect(`/admin/orders/${id}?snapp=${unresolved ? "updateunknown" : "updatefailed"}`);
  }

  // اسنپ‌پی has agreed. Record that first, in its own write: it is the only
  // evidence the refund happened, and it must survive the rewrite below failing
  // - otherwise a rolled-back transaction would leave money returned to the
  // buyer and nothing at all to say so.
  const opRow = await db.paymentOperation.create({
    data: {
      paymentId: payment.id,
      kind: "UPDATE",
      status: "OK",
      amountRial: tomanToRial(priced.total),
      message: `${summary} — مبلغ سفارش از ${order.total} به ${priced.total} تومان کاهش یافت.`,
      userId: admin.id,
      userName: admin.name ?? admin.phone,
    },
  });
  void opRow;

  // Now the shop's own records follow.
  const returning = order.stockApplied
    ? changed.map((l) => ({ productId: l.productId, sizeId: l.sizeId, qty: l.qty - l.newQty }))
    : [];

  // Club points were granted on the original total; a refund has to take back
  // the part that is no longer being paid, or the buyer keeps points for goods
  // they returned.
  const { pointsPer100k } = await getClubConfig();
  const pointsBack = order.pointsAwarded
    ? await pointsToReclaim(
        order.userId,
        pointsForOrder(order.total, pointsPer100k) - pointsForOrder(priced.total, pointsPer100k)
      )
    : 0;

  await db.$transaction([
    ...lines.filter((l) => l.newQty === 0).map((l) => db.orderItem.delete({ where: { id: l.id } })),
    ...lines
      .filter((l) => l.newQty > 0 && l.newQty !== l.qty)
      .map((l) => db.orderItem.update({ where: { id: l.id }, data: { qty: l.newQty } })),
    db.order.update({
      where: { id },
      data: {
        goodsTotal: priced.goodsTotal,
        discount: priced.discount,
        shippingCost: priced.shippingCost,
        total: priced.total,
      },
    }),
    db.payment.update({
      where: { id: payment.id },
      data: { amountRial: tomanToRial(priced.total) },
    }),
    ...returnStock(returning),
    ...(pointsBack > 0
      ? [db.user.update({ where: { id: order.userId }, data: { points: { decrement: pointsBack } } })]
      : []),
    ...(customerRequest
      ? [
          db.snappPayChangeRequest.update({
            where: { id: customerRequest.id },
            data: {
              status: "COMPLETED",
              pendingKey: null,
              reviewedAt: new Date(),
              reviewedById: admin.id,
              reviewedByName: admin.name ?? admin.phone,
              resolution: "درخواست تأیید و تغییر سفارش در اسنپ‌پی با موفقیت انجام شد.",
            },
          }),
        ]
      : []),
  ]);

  console.log(
    `[SNAPPPAY] order ${id} updated by ${admin.name ?? admin.phone}: ${summary} ` +
      `(${order.total} → ${priced.total} Toman, tx ${payment.resNum})`
  );

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/products");
  revalidatePath("/account");
  redirect(`/admin/orders/${id}?snapp=updated`);
}

/**
 * لغو کامل - the whole purchase goes back to the buyer's اسنپ‌پی credit and the
 * order is cancelled.
 *
 * Same ordering rule as the partial refund: اسنپ‌پی first, our records after.
 * After this the purchase is finished on both sides - there is no service that
 * undoes a cancel.
 */
export async function snapppayCancelOrder(formData: FormData) {
  const admin = await guardAdmin();
  const id = String(formData.get("id") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  if (!id) return;

  const found = await settledSnapppayPayment(id);
  if ("error" in found) redirect(`/admin/orders/${id}?snapp=${found.error}`);
  const { order, payment, token } = found;
  const customerRequest = await pendingCustomerRequest(requestId, id, "CANCEL");
  if (requestId && !customerRequest) redirect(`/admin/orders/${id}?snapp=requestinvalid`);

  const result = await snapppayCancel(token);

  // Unlike an update, a cancel CAN be confirmed after the fact: it is a payment
  // state, so if the answer went missing اسنپ‌پی can simply be asked.
  if (!result.ok) {
    let cancelled = false;
    if (result.timedOut) {
      const asked = await paymentStatus(token);
      cancelled = asked.ok && asked.status === "CANCEL";
      console.log(
        `[SNAPPPAY] order ${id} cancel timed out; status says ${asked.ok ? asked.status || "?" : asked.error}`
      );
    }

    if (!cancelled) {
      const unresolved = result.timedOut === true;
      await db.paymentOperation.create({
        data: {
          paymentId: payment.id,
          kind: "CANCEL",
          status: unresolved ? "UNKNOWN" : "FAILED",
          code: result.code ?? null,
          message: unresolved
            ? "پاسخی از اسنپ‌پی نرسید و وضعیت تراکنش هم لغو نشده بود؛ پیش از تلاش دوباره بررسی کنید."
            : result.error,
          userId: admin.id,
          userName: admin.name ?? admin.phone,
        },
      });
      console.log(
        `[SNAPPPAY] order ${id} cancel ${unresolved ? "UNRESOLVED" : "refused"}: ${result.error}`
      );
      redirect(`/admin/orders/${id}?snapp=${unresolved ? "cancelunknown" : "cancelfailed"}`);
    }
  }

  // اسنپ‌پی has refunded. Record it before rewriting anything, for the same
  // reason as the partial refund above.
  await db.paymentOperation.create({
    data: {
      paymentId: payment.id,
      kind: "CANCEL",
      status: "OK",
      amountRial: 0,
      message: `کل سفارش (${order.total} تومان) لغو و مرجوع شد.`,
      userId: admin.id,
      userName: admin.name ?? admin.phone,
    },
  });

  const { pointsPer100k } = await getClubConfig();
  const pointsBack = order.pointsAwarded
    ? await pointsToReclaim(order.userId, pointsForOrder(order.total, pointsPer100k))
    : 0;

  await db.$transaction([
    db.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        ...(order.stockApplied ? { stockApplied: false } : {}),
        ...(order.pointsAwarded ? { pointsAwarded: false } : {}),
      },
    }),
    // REVERSED, not CANCELLED: the money did move and then came back, which is
    // a different thing from an attempt the buyer walked away from.
    db.payment.update({
      where: { id: payment.id },
      data: { status: "REVERSED", message: "سفارش لغو و مبلغ به اعتبار اسنپ‌پی برگشت داده شد." },
    }),
    ...(order.stockApplied ? returnStock(order.items) : []),
    ...(pointsBack > 0
      ? [db.user.update({ where: { id: order.userId }, data: { points: { decrement: pointsBack } } })]
      : []),
    ...(customerRequest
      ? [
          db.snappPayChangeRequest.update({
            where: { id: customerRequest.id },
            data: {
              status: "COMPLETED",
              pendingKey: null,
              reviewedAt: new Date(),
              reviewedById: admin.id,
              reviewedByName: admin.name ?? admin.phone,
              resolution: "درخواست تأیید و سفارش در اسنپ‌پی به‌طور کامل لغو شد.",
            },
          }),
        ]
      : []),
  ]);

  console.log(
    `[SNAPPPAY] order ${id} CANCELLED by ${admin.name ?? admin.phone} ` +
      `(${order.total} Toman refunded, tx ${payment.resNum})`
  );

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/products");
  revalidatePath("/account");
  redirect(`/admin/orders/${id}?snapp=cancelled`);
}

export async function rejectSnapppayChangeRequest(formData: FormData) {
  const admin = await guardAdmin();
  const id = String(formData.get("id") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  if (!id || !requestId) return;

  const request = await db.snappPayChangeRequest.findFirst({
    where: { id: requestId, orderId: id, status: "PENDING", pendingKey: id },
  });
  if (!request) redirect(`/admin/orders/${id}?snapp=requestinvalid`);

  await db.snappPayChangeRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      pendingKey: null,
      reviewedAt: new Date(),
      reviewedById: admin.id,
      reviewedByName: admin.name ?? admin.phone,
      resolution: "درخواست پس از بررسی فروشگاه رد شد. برای پیگیری با پشتیبانی فروشگاه تماس بگیرید.",
    },
  });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/account");
  redirect(`/admin/orders/${id}?snapp=requestrejected`);
}
