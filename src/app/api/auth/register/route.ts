import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getClubConfig } from "@/lib/club-data";

/** Sign up with just phone + name + password - no OTP. Useful when SMS is
 *  unreliable. If the phone already has an account, they're told to log in. */
export async function POST(req: Request) {
  const limited = rateLimit(`register:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کن." },
      { status: 429 }
    );
  }

  const { phone, name, password } = await req.json().catch(() => ({}));
  if (typeof phone !== "string" || !/^09\d{9}$/.test(phone.trim())) {
    return NextResponse.json({ ok: false, error: "شماره موبایل معتبر نیست." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ ok: false, error: "رمز عبور باید حداقل ۶ کاراکتر باشد." }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { phone: phone.trim() } });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "این شماره قبلاً ثبت شده؛ با رمز عبور وارد شو." },
      { status: 409 }
    );
  }

  const { welcomePoints } = await getClubConfig();
  const user = await db.user.create({
    data: {
      phone: phone.trim(),
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      passwordHash: hashPassword(password),
      points: welcomePoints,
    },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
