import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pointsForOrder } from "@/lib/club";
import { getClubConfig } from "@/lib/club-data";
import { takeStock } from "@/lib/stock";
import { notifyShopOwner } from "@/lib/notify";
import {
  verifyTransaction,
  reverseTransaction,
  sepSandbox,
  SEP_STATE_FA,
} from "@/lib/sep";

export const dynamic = "force-dynamic";

const site = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** SEP sends the buyer back here by POST; send them onward with a GET (303). */
const back = (orderId: string | null) =>
  NextResponse.redirect(
    orderId ? `${site()}/checkout/success?order=${orderId}` : `${site()}/account`,
    303
  );

/**
 * نتیجه پرداخت - the merchant-side half of the SEP flow.
 *
 * The callback body is NOT trusted for anything financial: it only tells us
 * which attempt finished. The amount and the success of the transaction are
 * re-established by calling VerifyTransaction, as the doc requires.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(null);
  }

  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };

  const resNum = get("ResNum");
  const refNum = get("RefNum");
  const state = get("State") ?? "Failed";

  if (!resNum) return back(null);

  const payment = await db.payment.findUnique({
    where: { resNum },
    include: { order: true },
  });
  // A دیجی‌پی attempt is settled by its own route, against its own gateway.
  if (!payment || payment.provider !== "SEP") return back(null);

  const orderId = payment.orderId;

  // Already settled (browser back button, duplicate callback) - nothing to redo.
  if (payment.status === "PAID") return back(orderId);

  const fail = async (status: string, message: string) => {
    await db.payment.update({
      where: { id: payment.id },
      data: { status, message, traceNo: get("TraceNo"), rrn: get("RRN") },
    });
    // Audit trail in pm2 logs - no card data, just enough to trace a dispute.
    console.log(`[PAY] order ${orderId} → ${status} (ref ${refNum ?? "-"}, state ${state}): ${message}`);
    return back(orderId);
  };

  // نکته ۱: an empty RefNum means the transaction never completed.
  if (state !== "OK" || !refNum) {
    return fail(
      state === "CanceledByUser" ? "CANCELLED" : "FAILED",
      SEP_STATE_FA[state] ?? "پرداخت انجام نشد."
    );
  }

  // Double-spend guard: a receipt may only ever settle one order.
  const seen = await db.payment.findFirst({
    where: { refNum, NOT: { id: payment.id } },
  });
  if (seen) {
    return fail("FAILED", "این رسید پرداخت قبلاً استفاده شده است.");
  }

  // ── Verify with the bank ─────────────────────────────────────
  // In sandbox there is no bank to ask, so the verified amount is simulated.
  // VerifiedAmountRial lets the test suite force a mismatch and exercise the
  // refund path below; it is ignored unless SEP_SANDBOX=1.
  const verified = sepSandbox()
    ? {
        ok: true as const,
        amountRial: Number(get("VerifiedAmountRial") ?? payment.amountRial),
        affectiveAmountRial: payment.amountRial,
        duplicate: false,
        rrn: get("RRN"),
        maskedPan: get("SecurePan"),
        traceNo: get("TraceNo"),
      }
    : await verifyTransaction(refNum);

  if (!verified.ok) {
    return fail("FAILED", verified.error);
  }

  // Amount must match the invoice; if not, the doc requires a full refund.
  if (verified.amountRial !== payment.amountRial) {
    if (!sepSandbox()) await reverseTransaction(refNum);
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "MISMATCH",
        refNum,
        message: `مبلغ تراکنش با فاکتور مطابقت ندارد؛ مبلغ به حساب شما برگشت می‌خورد.`,
      },
    });
    console.log(
      `[PAY] order ${orderId} → MISMATCH: paid ${verified.amountRial} ≠ invoice ${payment.amountRial} Rial (ref ${refNum}) — reversed`
    );
    return back(orderId);
  }

  // ── Success ──────────────────────────────────────────────────
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      refNum,
      paidAt: new Date(),
      message: null,
      rrn: verified.rrn ?? get("RRN"),
      traceNo: verified.traceNo ?? get("TraceNo"),
      maskedPan: verified.maskedPan ?? get("SecurePan"),
    },
  });

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  // Fulfilment happens exactly once per order: mark paid, grant club points and
  // take the goods out of inventory. The guarded updateMany is the claim - two
  // callbacks racing here both reach this line, but only one matches the row
  // while pointsAwarded is still false; the loser sees count 0 and does nothing.
  if (order && !order.pointsAwarded) {
    const { pointsPer100k } = await getClubConfig();
    const fulfilled = await db.$transaction(async (tx) => {
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

    if (fulfilled) notifyShopOwner(order.id, order.fullName, order.total).catch(() => {});
  }

  console.log(`[PAY] order ${orderId} PAID ✓ ${payment.amountRial / 10} Toman (ref ${refNum})`);
  return back(orderId);
}

/** Some terminals are configured with GetMethod=true and return via GET. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const body = new FormData();
  url.searchParams.forEach((v, k) => body.append(k, v));
  return POST(new Request(req.url, { method: "POST", body }));
}
