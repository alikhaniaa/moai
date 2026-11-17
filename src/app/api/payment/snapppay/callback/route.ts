import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfilPaidOrder } from "@/lib/fulfil";
import { notifyShopOwner } from "@/lib/notify";
import { finalize, revert, paymentStatus } from "@/lib/snapppay-api";

export const dynamic = "force-dynamic";

const site = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** اسنپ‌پی returns the buyer by POST; send them onward with a GET (303). */
const back = (orderId: string | null) =>
  NextResponse.redirect(
    orderId ? `${site()}/checkout/success?order=${orderId}` : `${site()}/account`,
    303
  );

/**
 * نتیجه پرداخت اسنپ‌پی - the merchant-side half of the SnappPay instalment flow.
 * Implemented from "Online Purchase by Merchants REST API" ویرایش 2.1 (2026-01-19), p.15.
 *
 * SnappPay **submits a form** to the returnURL we sent with the payment token,
 * carrying exactly three fields:
 *
 *   transactionId  the id we generated at token time (Payment.resNum)
 *   state          OK | FAILED
 *   amount         IRR
 *
 * Nothing in that form is signed, and the URL is public: anyone who learns it
 * can POST `state=OK` at it. So the body is used for exactly one thing - 
 * telling us WHICH attempt finished - and whether money actually moved is
 * established by calling verify ourselves, over TLS, with our own credentials.
 * That is the same rule the SEP and دیجی‌پی integrations follow.
 *
 * The doc is emphatic about one more thing (p.9):
 *
 *   «پذیرنده صرفاً یک بار سرویس verify را فراخوانی کند (حتی اگر استثنائاً
 *    فراخوانی آدرس بازگشتی پذیرنده چندین بار رخ داده باشد).»
 *
 * That mechanism is the atomic claim below: the attempt is moved PENDING →
 * VERIFYING in a single guarded write before anything is called, so two
 * callbacks racing here result in exactly one verify.
 *
 * And the settlement rule (p.9): state=OK must end in verify + settle;
 * state=FAILED must end in revert. A withdrawal that is neither settled nor
 * reverted is the buyer's credit left hanging, which is the one outcome the
 * shop can't fix from the admin panel.
 */
export async function POST(req: Request) {
  // The doc says «submits a form». Query and JSON are accepted too, so a change
  // of transport on their side can't strand a paid order.
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

  const transactionId = get("transactionId", "transaction_id");
  const state = (get("state", "status") ?? "").toUpperCase();
  const declaredAmount = Number(get("amount") ?? NaN);

  if (!transactionId) return back(null);

  const payment = await db.payment.findUnique({
    where: { resNum: transactionId },
    include: { order: true },
  });
  // A SEP or دیجی‌پی attempt is settled by its own route, against its own gateway.
  if (!payment || payment.provider !== "SNAPPPAY") return back(null);

  const orderId = payment.orderId;
  const paymentToken = payment.token;

  // ── The «call verify just once» mechanism the doc requires ───
  // Two callbacks racing here both reach this line, but only one moves the row
  // out of PENDING; the loser sees count 0 and calls nothing at all. Without
  // this, a duplicate callback would verify - or worse, revert - a second time.
  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "VERIFYING" },
  });
  if (claimed.count === 0) {
    console.log(
      `[SNAPPPAY] order ${orderId} duplicate callback ignored (already ${payment.status}, said ${state || "-"})`
    );
    return back(orderId);
  }

  /**
   * Give up on this attempt, reverting the withdrawal if there is one to revert.
   * `revert` is safe to call on an attempt that never got as far as a
   * withdrawal - SnappPay answers 1011 «invalid transaction status», which is
   * logged and otherwise ignored.
   */
  const fail = async (status: string, message: string, alreadyBack = false) => {
    // `alreadyBack` means اسنپ‌پی has told us the money is REVERT/CANCEL already.
    // Calling revert again would only earn a 1011 and muddy the log.
    if (paymentToken && !alreadyBack) {
      const reverted = await revert(paymentToken);
      if (!reverted.ok) {
        console.log(`[SNAPPPAY] order ${orderId} revert failed: ${reverted.error}`);
      }
    }
    await db.payment.update({
      where: { id: payment.id },
      data: { status, message },
    });
    // Audit trail in pm2 logs - no card data, just enough to trace a dispute.
    console.log(
      `[SNAPPPAY] order ${orderId} → ${status} (tx ${transactionId}, state ${state || "-"}): ${message}`
    );
    return back(orderId);
  };

  // state=FAILED → the doc requires revert, which `fail` does. Checked before
  // the token, so an attempt the buyer simply walked away from reads as
  // cancelled rather than as a missing-token fault.
  //
  // A state we could not READ is a third case, and the dangerous one. The body
  // is unsigned and we already refuse to trust it for anything else; if a proxy
  // mangles the form, or اسنپ‌پی moves the field, `state` arrives empty - and
  // reverting on that alone would hand back a purchase that actually succeeded.
  // So an unreadable state asks اسنپ‌پی directly instead of guessing.
  if (state !== "OK") {
    if (state === "" && paymentToken) {
      const asked = await paymentStatus(paymentToken);
      if (asked.ok && (asked.status === "VERIFY" || asked.status === "SETTLE")) {
        console.log(
          `[SNAPPPAY] order ${orderId} callback carried no state, but اسنپ‌پی says ${asked.status} — continuing as OK`
        );
      } else {
        return fail(
          "FAILED",
          "نتیجهٔ پرداخت از اسنپ‌پی خوانده نشد؛ اگر مبلغی کم شده باشد برمی‌گردد.",
          asked.ok && (asked.status === "REVERT" || asked.status === "CANCEL")
        );
      }
    } else {
      return fail(
        state === "FAILED" ? "FAILED" : "CANCELLED",
        state === "FAILED" ? "خرید اقساطی انجام نشد." : "پرداخت توسط شما لغو شد."
      );
    }
  }

  // A token we never stored means the attempt died before it reached SnappPay - 
  // and with no token there is nothing that can be verified OR reverted.
  if (!paymentToken) {
    return fail("FAILED", "توکن پرداخت اسنپ‌پی برای این سفارش ثبت نشده است.");
  }

  // The amount can only ever be what we put in the token request, so a
  // disagreement means something is wrong upstream - don't ship against it.
  if (Number.isFinite(declaredAmount) && declaredAmount !== payment.amountRial) {
    await fail(
      "MISMATCH",
      "مبلغ تراکنش با فاکتور مطابقت ندارد؛ مبلغ به اعتبار اسنپ‌پی شما برگشت می‌خورد."
    );
    console.log(
      `[SNAPPPAY] order ${orderId} → MISMATCH: callback said ${declaredAmount} ≠ invoice ${payment.amountRial} Rial (tx ${transactionId})`
    );
    return back(orderId);
  }

  // ── Ask اسنپ‌پی what really happened (doc p.9, p.20–21) ───────
  //
  // `finalize` is verify followed by settle, each with the recovery path the
  // doc spells out: when either one times out or answers false, Get Payment
  // Status is consulted and the call is retried or abandoned according to what
  // it says. That fallback is required to be in the code itself rather than
  // left to a human - it is the only thing standing between a timeout and our
  // record of an order disagreeing with SnappPay's.
  const outcome = await finalize(paymentToken);
  console.log(`[SNAPPPAY] order ${orderId} finalize: ${outcome.trail.join(" → ")}`);

  if (!outcome.verified) {
    return fail(
      outcome.reverted ? "REVERSED" : "FAILED",
      outcome.error ?? "تأیید تراکنش اسنپ‌پی انجام نشد.",
      outcome.reverted
    );
  }

  // A verified withdrawal still needs settlement. Keep the order unpaid and
  // block another charge until recovery establishes SETTLE or reversal.
  if (!outcome.settled) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "SETTLEMENT_PENDING",
        refNum: outcome.transactionId || transactionId,
        traceNo: transactionId,
        message: "تأیید پرداخت دریافت شد؛ تسویه در حال بررسی است. لطفاً دوباره پرداخت نکنید.",
      },
    });
    console.log(
      `[SNAPPPAY] ⚠ order ${orderId} verified but NOT settled — settle by hand (node tools/snapppaycheck.mjs --settle)`
    );
    return back(orderId);
  }

  // ── Success ──────────────────────────────────────────────────
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      refNum: outcome.transactionId || transactionId,
      paidAt: new Date(),
      settledAt: outcome.settled ? new Date() : null,
      message: outcome.settled ? null : "پرداخت تأیید شد اما تسویه با اسنپ‌پی انجام نشد.",
      traceNo: transactionId,
    },
  });

  // Fulfilment happens exactly once per order - the same call the reconcile tool
  // makes when a callback never arrived, so the two can never disagree.
  if (await fulfilPaidOrder(orderId)) {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (order) notifyShopOwner(order.id, order.fullName, order.total).catch(() => {});
  }

  console.log(
    `[SNAPPPAY] order ${orderId} PAID ✓ ${payment.amountRial / 10} Toman in 4 instalments ` +
      `(tx ${transactionId}, settled ${outcome.settled ? "✓" : "✗"})`
  );
  return back(orderId);
}

/** Some configurations return the buyer by GET; the fields ride the query string. */
export async function GET(req: Request) {
  return POST(new Request(req.url, { method: "POST" }));
}
