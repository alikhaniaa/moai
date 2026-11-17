import "server-only";
import { tomanToRial, type SnappPayCartItem } from "@/lib/snapppay-api";

/**
 * An order's items as اسنپ‌پی cart lines.
 *
 * Shared by the token request (checkout) and by تغییر سبد (admin), because the
 * two must describe the same basket in the same words - SnappPay compares them,
 * and a purchase that was registered with one set of line names and amended
 * with another is exactly the mismatch the certification review looks for.
 *
 * `amountRial` is the unit price. SnappPay multiplies it by count (doc p.14).
 * Product discounts are already reflected in unitPrice; the additional coupon
 * is order-level and travels in `discountAmount` instead.
 *
 * An item whose quantity has been reduced to zero is dropped entirely rather
 * than sent with `count: 0` - «اگر آیتم کارتی کاملا حذف می‌شود، لازم است از بین
 * کارت آیتم‌ها نیز حذف شود» (doc p.23).
 */
export type OrderLine = {
  /** the OrderItem's own id - see `numericLineId` */
  id: string;
  productId: string;
  nameFa: string;
  sizeLabel: string | null;
  colorName: string | null;
  unitPrice: number;
  qty: number;
};

/**
 * A stable positive integer for a cart line.
 *
 * SnappPay's `cartItems[].id` must be **numeric** - a cuid is refused outright
 * with 1005 «couldn't deserialize the request body», which would have broken
 * every real checkout, since every id in this codebase is a cuid. (Measured
 * against staging on 2026-09-07: `101` and `"101"` are accepted, `"abc"` and a
 * cuid are not.)
 *
 * It is derived from the OrderItem's id rather than the product's for two
 * reasons: two lines of the same product in different sizes are different cart
 * items and must not share an id, and the value has to stay the same between
 * the token request and any later تغییر سبد, which rules out a positional index
 * - removing a line would renumber the ones after it.
 *
 * FNV-1a, folded into 31 bits so it is always a positive int32.
 */
export function numericLineId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

export const snapppayItems = (items: OrderLine[]): SnappPayCartItem[] =>
  items
    .filter((i) => i.qty > 0)
    .map((i) => ({
      id: numericLineId(i.id),
      name: [i.nameFa, i.sizeLabel && `سایز ${i.sizeLabel}`, i.colorName && `رنگ ${i.colorName}`]
        .filter(Boolean)
        .join(" — "),
      amountRial: tomanToRial(i.unitPrice),
      count: i.qty,
      category: "پوشاک",
    }));

/**
 * What an order costs after the admin has removed items or cut quantities.
 *
 * Three rules, all of them about giving back exactly what the buyer paid and
 * never a رial more - SnappPay refuses an update that raises the total (1042),
 * and the shop should not be refunding money it never took:
 *
 *  - shipping is left exactly as it was. Re-running the free-shipping threshold
 *    on a smaller basket could put the carriage charge *back*, which would bill
 *    the buyer for a refund.
 *  - the coupon is **pro-rated**, not kept whole. A ۱۰۰٬۰۰۰ تومان code against
 *    ۸۵۰٬۰۰۰ تومان of goods means the buyer paid ۸۸٪ of every sticker price, so
 *    returning a ۲۵۰٬۰۰۰ تومان item gives back ۲۲۰٬۵۸۸, not ۲۵۰٬۰۰۰. Keeping the
 *    discount whole would refund the full list price of goods the buyer got at a
 *    discount, and the shop would lose the difference on every partial return.
 *  - it is clamped to the goods that remain, so a coupon can never make the
 *    goods line go negative.
 *
 * The result is monotone: goods can only fall, and the pro-rated discount falls
 * with them, so the total can only fall too.
 */
export function repriceOrder(
  lines: OrderLine[],
  original: { goodsTotal: number; discount: number; shippingCost: number }
) {
  const goodsTotal = lines.reduce((s, l) => s + l.unitPrice * Math.max(0, l.qty), 0);
  const kept = Math.max(0, original.goodsTotal);
  const discount =
    kept > 0 && original.discount > 0
      ? Math.min(goodsTotal, Math.round((original.discount * goodsTotal) / kept))
      : 0;
  const shippingCost = original.shippingCost;
  return { goodsTotal, discount, shippingCost, total: goodsTotal - discount + shippingCost };
}
