import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getClubConfig } from "@/lib/club-data";

/** A 5-digit code must not be guessable: the code dies after this many misses. */
const MAX_ATTEMPTS = 5;

/** Step 2 of login: verify the code, create/find the user, open a session. */
export async function POST(req: Request) {
  // Blunt stop on automated guessing, independent of which phone is targeted.
  const limited = rateLimit(`otp-verify:${clientIp(req)}`, 20, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن." },
      { status: 429 }
    );
  }

  const { phone, code } = await req.json().catch(() => ({}));

  if (typeof phone !== "string" || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "درخواست نامعتبر" }, { status: 400 });
  }

  const otp = await db.otp.findFirst({
    where: { phone, used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return NextResponse.json({ ok: false, error: "کد معتبری یافت نشد؛ دوباره درخواست بده." }, { status: 401 });
  }
  if (otp.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "کد منقضی شده؛ دوباره درخواست بده." }, { status: 401 });
  }

  if (otp.code !== code.trim()) {
    const attempts = otp.attempts + 1;
    // Burn the code once too many guesses have been made, so an attacker can
    // never work through the 100,000 possibilities.
    await db.otp.update({
      where: { id: otp.id },
      data: { attempts, used: attempts >= MAX_ATTEMPTS },
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          attempts >= MAX_ATTEMPTS
            ? "تعداد تلاش‌ها زیاد شد. لطفاً کد جدید بگیر."
            : "کد وارد شده درست نیست.",
      },
      { status: 401 }
    );
  }

  await db.otp.update({ where: { id: otp.id }, data: { used: true } });

  const existing = await db.user.findUnique({ where: { phone } });
  let user = existing;
  if (!user) {
    const { welcomePoints } = await getClubConfig();
    user = await db.user.create({ data: { phone, points: welcomePoints } });
  }

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    isNew: !existing,
    isAdmin: user.role === "ADMIN",
  });
}
