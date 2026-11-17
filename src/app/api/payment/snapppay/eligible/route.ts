import { NextResponse } from "next/server";
import { eligible, snapppayEnabledFor, tomanToRial } from "@/lib/snapppay-api";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * آیا اسنپ‌پی این مبلغ را قسطی می‌کند - and, when it does, the wording to print.
 *
 * The checkout is not allowed to decide any of this for itself (doc FAQ 6): the
 * instalment row may only appear when اسنپ‌پی answers `eligible: true`, the two
 * lines it returns are shown unchanged, and because the figures are computed
 * from the amount the service is asked again on every change of the payable
 * total. So this endpoint is a thin pass-through and deliberately holds no
 * thresholds of its own - staging and production refuse different baskets.
 *
 * What it does NOT pass through is the failure text: اسنپ‌پی's error messages
 * describe our merchant account, not the buyer's basket, and have no business
 * in a browser. The checkout only ever needs to learn «don't offer the row».
 */
export async function POST(req: Request) {
  // asked again on every change of the total, so it is worth a ceiling - the
  // same one the coupon endpoint uses
  if (!rateLimit(`snapppay-eligible:${clientIp(req)}`, 30, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // gateway off - or on, but not for this buyer - = the checkout falls back to
  // the واتس‌اپ hand-off, and اسنپ‌پی is never called
  const user = await getSessionUser();
  if (!snapppayEnabledFor(user?.phone)) {
    return NextResponse.json({ ok: true, eligible: false });
  }

  const body = await req.json().catch(() => null);
  const amountToman = Number(body?.amountToman);
  if (!Number.isFinite(amountToman) || amountToman <= 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const res = await eligible(tomanToRial(Math.round(amountToman)));
  if (!res.ok) return NextResponse.json({ ok: false }, { status: 502 });

  return NextResponse.json({
    ok: true,
    eligible: res.eligible,
    // verbatim - not shortened, not reformatted, not translated
    title: res.title,
    description: res.description,
  });
}
