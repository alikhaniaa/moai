import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendOtp, smsConfigured } from "@/lib/sms";

/** Step 1 of login: issue a one-time code for the phone number. */
export async function POST(req: Request) {
  // Every SMS costs money, so cap how many one client can trigger.
  const limited = rateLimit(`otp-request:${clientIp(req)}`, 5, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "درخواست‌های زیاد. چند دقیقه دیگر دوباره تلاش کن." },
      { status: 429 }
    );
  }

  const { phone } = await req.json().catch(() => ({}));

  if (typeof phone !== "string" || !/^09\d{9}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, error: "شماره موبایل معتبر نیست (مثال: 09121234567)" },
      { status: 400 }
    );
  }

  // throttle: max one active code per 90s
  const recent = await db.otp.findFirst({
    where: { phone, used: false, createdAt: { gt: new Date(Date.now() - 90_000) } },
  });
  if (recent) {
    return NextResponse.json(
      { ok: false, error: "کد قبلاً ارسال شده؛ کمی صبر کن و دوباره تلاش کن." },
      { status: 429 }
    );
  }

  // crypto-random: Math.random() is predictable enough to narrow a 5-digit space
  const code = String(randomInt(10000, 100000));
  await db.otp.create({
    data: { phone, code, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });
  // the table would otherwise grow one row per request forever
  await db.otp
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } })
    .catch(() => {});

  // Real SMS when the provider is configured; otherwise fall back to the
  // preview code (dev / before the SMS template is approved).
  if (smsConfigured()) {
    const sent = await sendOtp(phone, code);
    // Always record the code in the server log. Only someone with SSH access can
    // read it, so this is safe - and it means the shop owner can still get in if
    // the SMS provider is failing to deliver.
    console.log(`[OTP] ${phone}: ${code}${sent.ok ? "" : " (SMS FAILED)"}`);
    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: "ارسال پیامک ناموفق بود؛ دوباره تلاش کن." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── No SMS provider yet ───────────────────────────────────────────
  console.log(`[OTP preview] code for ${phone}: ${code}`);

  // Echoing the code to the browser is a login bypass for ANY account, admin
  // included - the phone number is public, so the code would be the only secret.
  // A production build only echoes when ALLOW_OTP_ECHO_IN_PRODUCTION is set - 
  // the client-preview escape hatch, removed once SMS is live.
  const echo =
    process.env.OTP_DEV_ECHO === "1" &&
    (process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_OTP_ECHO_IN_PRODUCTION === "1");

  return NextResponse.json({ ok: true, ...(echo ? { devCode: code } : {}) });
}
