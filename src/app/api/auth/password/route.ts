import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Password login - the fallback for when SMS delivery is slow/failing. */
export async function POST(req: Request) {
  const limited = rateLimit(`pw-login:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن." },
      { status: 429 }
    );
  }

  const { phone, password } = await req.json().catch(() => ({}));
  if (typeof phone !== "string" || typeof password !== "string") {
    return NextResponse.json({ ok: false, error: "درخواست نامعتبر" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { phone: phone.trim() } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: "شماره موبایل یا رمز عبور درست نیست." },
      { status: 401 }
    );
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, isAdmin: user.role === "ADMIN" });
}
