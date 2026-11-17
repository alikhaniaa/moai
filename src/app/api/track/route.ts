import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  isBot, isCountedPath, normalisePath, pruneVisits, tehranDay, weekKeyOf,
} from "@/lib/visits";

export const dynamic = "force-dynamic";

const COOKIE = "moai_v";
const YEAR = 365 * 24 * 60 * 60;

/**
 * Counts one page view.
 *
 * A visitor is a first-party cookie and nothing else - no third-party script,
 * no fingerprint, nothing that leaves this server. Failures are swallowed:
 * analytics must never be able to break a page for a customer.
 */
export async function POST(req: Request) {
  try {
    if (isBot(req.headers.get("user-agent"))) return NextResponse.json({ ok: true });

    const body = await req.json().catch(() => null);
    const raw = typeof body?.path === "string" ? body.path : "";
    if (!raw) return NextResponse.json({ ok: true });

    const path = normalisePath(raw);
    if (!isCountedPath(path)) return NextResponse.json({ ok: true });

    const jar = await cookies();
    let visitorId = jar.get(COOKIE)?.value;
    if (!visitorId || visitorId.length < 8 || visitorId.length > 64) {
      visitorId = crypto.randomUUID();
      jar.set(COOKIE, visitorId, {
        maxAge: YEAR,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: (process.env.SITE_URL ?? "").startsWith("https"),
      });
    }

    const now = new Date();
    await db.pageView.create({
      data: { path, visitorId, day: tehranDay(now), weekKey: weekKeyOf(now) },
    });

    // keeps the table bounded without needing a cron job (throttled internally)
    await pruneVisits(now);
  } catch {
    // ignore - a missed view is worth far less than a broken page
  }
  return NextResponse.json({ ok: true });
}
