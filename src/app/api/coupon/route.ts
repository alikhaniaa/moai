import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { applyCoupon } from "@/lib/coupon";
import { priceCart } from "@/lib/pricing";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Checks a discount code and reports what it is worth for the current cart. */
export async function POST(req: Request) {
  // codes are short; without a limit they can be guessed in bulk
  if (!rateLimit(`coupon:${clientIp(req)}`, 30, 10 * 60_000).ok) {
    return NextResponse.json(
      { ok: false, error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کن." },
      { status: 429 }
    );
  }

  const user = await getSessionUser();
  const body = await req.json().catch(() => null);
  const { code, items, paymentMethod } = body ?? {};

  if (typeof code !== "string" || !Array.isArray(items)) {
    return NextResponse.json({ ok: false, error: "درخواست نامعتبر" }, { status: 400 });
  }

  const { goods } = await priceCart(items);
  const result = await applyCoupon(
    code,
    goods,
    user?.id ?? null,
    typeof paymentMethod === "string" ? paymentMethod : null
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
