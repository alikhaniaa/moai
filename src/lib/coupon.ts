import { db } from "./db";

export type CouponResult =
  | {
      ok: true;
      id: string;
      code: string;
      discount: number;
      freeShipping: boolean;
      /** false ⇒ اسنپ‌پی / دیجی‌پی must be refused while this code is on */
      allowInstallments: boolean;
      label: string;
    }
  | { ok: false; error: string };

export const normalizeCode = (raw: string) =>
  raw.trim().toUpperCase().replace(/\s+/g, "");

/**
 * Ways of paying that hand the buyer their goods before the shop holds the
 * whole amount - اسنپ‌پی takes it in four, دیجی‌پی can put it on credit. A code
 * marked «روی پرداخت قسطی اعمال نشود» is refused for these.
 *
 * کارت به کارت is deliberately NOT here: it is paid in full, only confirmed by
 * hand, so a code that works with the gateway works with it too.
 */
export const INSTALLMENT_METHODS = ["SNAPPPAY", "SNAPPPAY_IPG", "DIGIPAY"] as const;

export const isInstallmentMethod = (method?: string | null) =>
  !!method && (INSTALLMENT_METHODS as readonly string[]).includes(method);

/**
 * Validate a discount code for a given cart and customer, and work out what it
 * is worth. Always run this server-side before charging: the browser only ever
 * receives the result, never decides it.
 */
export async function applyCoupon(
  rawCode: string,
  goodsTotal: number,
  userId: string | null,
  /** how the buyer intends to pay, when that is known yet */
  paymentMethod?: string | null
): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "کد تخفیف را وارد کن." };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) {
    return { ok: false, error: "کد تخفیف معتبر نیست." };
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, error: "این کد هنوز فعال نشده است." };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { ok: false, error: "مهلت استفاده از این کد تمام شده است." };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "ظرفیت استفاده از این کد تکمیل شده است." };
  }
  if (coupon.userId && coupon.userId !== userId) {
    // personal codes must not reveal that they belong to someone else
    return { ok: false, error: "کد تخفیف معتبر نیست." };
  }
  if (!coupon.allowInstallments && isInstallmentMethod(paymentMethod)) {
    return {
      ok: false,
      error: "این کد تخفیف با پرداخت قسطی جمع نمی‌شود. روش پرداخت را عوض کن یا بدون کد ادامه بده.",
    };
  }
  if (goodsTotal < coupon.minSubtotal) {
    return {
      ok: false,
      error: `این کد برای خریدهای بالای ${coupon.minSubtotal.toLocaleString("fa-IR")} تومان است.`,
    };
  }

  if (userId && coupon.perUserLimit > 0) {
    const used = await db.order.count({
      // Only completed purchases consume the customer's allowance. An unpaid
      // checkout or a failed gateway attempt must not block their next order.
      where: { userId, couponId: coupon.id, status: { in: ["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"] } },
    });
    if (used >= coupon.perUserLimit) {
      return { ok: false, error: "قبلاً از این کد استفاده کرده‌ای." };
    }
  }

  const discount =
    coupon.type === "FIXED"
      ? Math.min(coupon.value, goodsTotal)
      : Math.floor((goodsTotal * Math.min(90, Math.max(1, coupon.value))) / 100);

  return {
    ok: true,
    id: coupon.id,
    code: coupon.code,
    discount,
    freeShipping: coupon.freeShipping,
    allowInstallments: coupon.allowInstallments,
    label:
      coupon.type === "FIXED"
        ? `${coupon.value.toLocaleString("fa-IR")} تومان تخفیف`
        : `٪${coupon.value.toLocaleString("fa-IR")} تخفیف`,
  };
}

/** Delivery options a customer can choose between, cheapest first. */
export async function getShippingMethods() {
  return db.shippingMethod.findMany({
    where: { active: true },
    orderBy: [{ sort: "asc" }, { cost: "asc" }],
  });
}

export const shippingCostFor = (
  method: { cost: number; freeFrom: number } | null,
  goodsAfterDiscount: number,
  couponFreeShipping = false
) => {
  if (!method) return 0;
  if (couponFreeShipping) return 0;
  if (method.freeFrom > 0 && goodsAfterDiscount >= method.freeFrom) return 0;
  return method.cost;
};
