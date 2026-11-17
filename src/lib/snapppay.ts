/**
 * خرید چهار قسطه اسنپ‌پی - SnappPay "pay in four".
 *
 * IMPORTANT: no money moves through this file, and none moves through the site.
 * SnappPay registers the buyer and collects the four instalments themselves;
 * the shop confirms the order by hand once that registration is done. Everything
 * here is a *mirror* of SnappPay's schedule so the buyer and the admin can see
 * what is left to pay - it is never a ledger and must never be treated as one.
 *
 * Because of that, due dates are marked «تقریبی» everywhere they are shown: the
 * authoritative dates live in the SnappPay app, not here.
 */

export const SNAPPPAY_PARTS = 4;

export type Installment = {
  /** 1..4 */
  n: number;
  /** Toman */
  amount: number;
  /** instalment 1 is taken by SnappPay at registration, so it is paid on approval */
  paid: boolean;
  /** estimated due date; null until the shop approves the order */
  due: Date | null;
};

/**
 * Split a total into four whole-Toman parts.
 *
 * The remainder rides on the FIRST instalment - the one SnappPay takes at
 * registration - so the three the buyer still owes are equal round numbers.
 * The parts always add up to exactly `total`; never re-round them downstream.
 */
export function splitInstallments(total: number): number[] {
  const safe = Math.max(0, Math.round(total));
  const base = Math.floor(safe / SNAPPPAY_PARTS);
  const parts = Array.from({ length: SNAPPPAY_PARTS }, () => base);
  parts[0] = safe - base * (SNAPPPAY_PARTS - 1);
  return parts;
}

/**
 * Same day-of-month, `months` later, clamped to the target month's length so
 * the 31st never silently rolls into the next month (`setMonth` alone does).
 */
function addMonths(from: Date, months: number): Date {
  const out = new Date(from.getTime());
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
}

/**
 * The four instalments for an order.
 *
 * `approvedAt` is when the shop confirmed the SnappPay registration - the clock
 * for instalments 2/3/4 starts there, not at checkout, because the buyer may
 * message on WhatsApp days after ordering. Before approval every instalment is
 * unpaid and dateless.
 */
export function installmentPlan(
  total: number,
  approvedAt: Date | string | null
): Installment[] {
  const amounts = splitInstallments(total);
  const start = approvedAt ? new Date(approvedAt) : null;

  return amounts.map((amount, i) => ({
    n: i + 1,
    amount,
    paid: start !== null && i === 0,
    due: start ? (i === 0 ? start : addMonths(start, i)) : null,
  }));
}

/** What the buyer still owes SnappPay. */
export const remainingAmount = (plan: Installment[]) =>
  plan.reduce((sum, p) => (p.paid ? sum : sum + p.amount), 0);

/** How many instalments are still to come. */
export const remainingCount = (plan: Installment[]) =>
  plan.filter((p) => !p.paid).length;

/** Per-instalment figure used for "۴ قسط ×" copy before an order exists. */
export const perInstallment = (total: number) => splitInstallments(total)[0];
