import { db } from "@/lib/db";
import { pointsForOrder } from "@/lib/club";
import { getClubConfig } from "@/lib/club-data";
import { takeStock } from "@/lib/stock";

/**
 * Everything that has to happen to an order exactly once, the moment money is
 * confirmed: mark it paid, grant the club points, take the goods off the shelf
 * and count the coupon.
 *
 * It lives here rather than inside the gateway callback because the callback is
 * not the only thing that can establish payment. When a callback never arrives - 
 * the buyer closed the tab, or the POST never reached the server - 
 * `tools/snapppaycheck.mjs --reconcile` asks اسنپ‌پی directly and finishes the
 * job, and it has to finish it the *same* way or the shop's books drift.
 *
 * The guarded `updateMany` is the claim: two callers racing here both reach it,
 * but only one matches the row while `pointsAwarded` is still false. The loser
 * sees count 0 and does nothing, so points cannot be granted twice and stock
 * cannot leave the shelf twice.
 *
 * Returns true only for the caller that actually did it - the one that should
 * send the shop owner a notification.
 */
export async function fulfilPaidOrder(orderId: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.pointsAwarded) return false;
  // A verified withdrawal is not a settled sale. Applies to callback and recovery.
  if (order.paymentMethod === "SNAPPPAY_IPG") {
    const settled = await db.payment.findFirst({
      where: { orderId, provider: "SNAPPPAY", status: "PAID", settledAt: { not: null } },
    });
    if (!settled) return false;
  }

  const { pointsPer100k } = await getClubConfig();

  return db.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, pointsAwarded: false },
      data: { status: "PAID", pointsAwarded: true, stockApplied: true },
    });
    if (claimed.count === 0) return false;

    await tx.user.update({
      where: { id: order.userId },
      data: { points: { increment: pointsForOrder(order.total, pointsPer100k) } },
    });
    if (!order.stockApplied) await Promise.all(takeStock(order.items, tx));
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }
    return true;
  });
}
