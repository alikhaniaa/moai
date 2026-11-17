import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pointsForOrder } from "@/lib/club";
import { getClubConfig } from "@/lib/club-data";
import { takeStock } from "@/lib/stock";
import { notifyShopOwner } from "@/lib/notify";
import { verifyPurchase } from "@/lib/digipay";

export const dynamic = "force-dynamic";

const site = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** DigiPay returns the buyer by POST; send them onward with a GET (303). */
const back = (orderId: string | null) =>
  NextResponse.redirect(
    orderId ? `${site()}/checkout/success?order=${orderId}` : `${site()}/account`,
    303
  );

/**
 * نتیجه پرداخت دیجی‌پی - the merchant-side half of the DigiPay flow.
 *
 * DigiPay signs nothing: this endpoint is a public URL that anyone can POST
 * `result=SUCCESS` to. So the body is used for exactly one thing - telling us
 * WHICH attempt finished - and every financial fact (did it succeed, how much
 * was taken) comes back from /purchases/verify, called by us, over TLS, with
 * our own credentials. An unverifiable callback settles nothing.
 */
export async function POST(req: Request) {
  // DigiPay's docs don't state the encoding, so accept form, JSON or query.
  const url = new URL(req.url);
  const fields: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (fields[k] = v));

  const ctype = req.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(body ?? {})) {
        if (v !== null && v !== undefined && typeof v !== "object") fields[k] = String(v);
      }
    } else {
      const form = await req.formData();
      form.forEach((v, k) => {
        if (typeof v === "string") fields[k] = v;
      });
    }
  } catch {
    // a bodyless POST is fine as long as the query string carried the fields
  }

  const get = (...names: string[]) => {
    for (const n of names) {
      const hit = Object.keys(fields).find((k) => k.toLowerCase() === n.toLowerCase());
      if (hit && fields[hit]) return fields[hit];
    }
    return undefined;
  };

  const providerId = get("providerId", "provider_id");
  const trackingCode = get("trackingCode", "tracking_code");
  const declared = (get("result", "status") ?? "").toUpperCase();
  const type = Number(get("type") ?? 0);

  if (!providerId) return back(null);

  const payment = await db.payment.findUnique({
    where: { resNum: providerId },
    include: { order: true },
  });
  if (!payment || payment.provider !== "DIGIPAY") return back(null);

  const orderId = payment.orderId;

  // Already settled (browser back button, duplicate callback) - nothing to redo.
  if (payment.status === "PAID") return back(orderId);

  const fail = async (status: string, message: string) => {
    await db.payment.update({
      where: { id: payment.id },
      data: { status, message, traceNo: trackingCode ?? null },
    });
    console.log(
      `[DIGIPAY] order ${orderId} → ${status} (tracking ${trackingCode ?? "-"}, said ${declared || "-"}): ${message}`
    );
    return back(orderId);
  };

  // No trackingCode means the buyer never got as far as a transaction.
  if (!trackingCode) {
    return fail(
      declared === "FAILURE" ? "FAILED" : "CANCELLED",
      declared === "FAILURE" ? "پرداخت انجام نشد." : "پرداخت توسط شما لغو شد."
    );
  }

  // Double-spend guard: one receipt may only ever settle one order.
  const seen = await db.payment.findFirst({
    where: { refNum: trackingCode, NOT: { id: payment.id } },
  });
  if (seen) return fail("FAILED", "این رسید پرداخت قبلاً استفاده شده است.");

  // ── Ask DigiPay what really happened ─────────────────────────
  // Deliberately NOT gated on `declared`: a caller claiming FAILURE could
  // otherwise strand a payment that actually went through, and one claiming
  // SUCCESS is worth nothing until this call agrees.
  const verified = await verifyPurchase({ trackingCode, providerId, type });

  if (!verified.ok) {
    return fail("FAILED", verified.error);
  }

  // The amount must match the invoice to the Rial.
  if (verified.amountRial !== payment.amountRial) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "MISMATCH",
        refNum: trackingCode,
        message: "مبلغ تراکنش با فاکتور مطابقت ندارد؛ لطفاً با پشتیبانی تماس بگیر.",
      },
    });
    console.log(
      `[DIGIPAY] order ${orderId} → MISMATCH: paid ${verified.amountRial} ≠ invoice ${payment.amountRial} Rial (tracking ${trackingCode})`
    );
    return back(orderId);
  }

  // ── Success ──────────────────────────────────────────────────
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      refNum: trackingCode,
      paidAt: new Date(),
      message: null,
      rrn: get("rrn") ?? null,
      traceNo: trackingCode,
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

  console.log(
    `[DIGIPAY] order ${orderId} PAID ✓ ${payment.amountRial / 10} Toman (tracking ${trackingCode})`
  );
  return back(orderId);
}

/** Some configurations return the buyer by GET. */
export async function GET(req: Request) {
  return POST(new Request(req.url, { method: "POST" }));
}
