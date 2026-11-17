import { db } from "./db";

/**
 * Weekly visitor counting.
 *
 * A week runs شنبه تا جمعه in Tehran time, so every date here is resolved in
 * `Asia/Tehran` rather than the server's own zone - otherwise the week would
 * roll over at the wrong moment and the "this week vs last week" comparison
 * on /admin/visits would be quietly wrong.
 */

const TEHRAN = "Asia/Tehran";

/** Tehran calendar date of an instant, as YYYY-MM-DD. */
export function tehranDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 0 = Sunday … 6 = Saturday, in Tehran. */
function tehranWeekday(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TEHRAN, weekday: "short" }).format(at);
  return WEEKDAY.indexOf(name);
}

const dayMs = 86_400_000;

/** Shift a YYYY-MM-DD string by whole days without touching time zones. */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The week a moment belongs to, named by the Tehran date of its شنبه.
 * Sortable as a plain string, which is all the admin page needs.
 */
export function weekKeyOf(at: Date = new Date()): string {
  const today = tehranDay(at);
  const wd = tehranWeekday(at); // Sat = 6
  const sinceSaturday = (wd + 1) % 7; // Sat→0, Sun→1, … Fri→6
  return shiftDay(today, -sinceSaturday);
}

/** The `count` most recent week keys, oldest first, ending with this week. */
export function recentWeekKeys(count: number, at: Date = new Date()): string[] {
  const current = weekKeyOf(at);
  return Array.from({ length: count }, (_, i) => shiftDay(current, -7 * (count - 1 - i)));
}

/** The `count` most recent Tehran days, oldest first, ending today. */
export function recentDays(count: number, at: Date = new Date()): string[] {
  const today = tehranDay(at);
  return Array.from({ length: count }, (_, i) => shiftDay(today, -(count - 1 - i)));
}

/** «۱۵ شهریور» style label for a Gregorian YYYY-MM-DD. */
export function faDayLabel(day: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(`${day}T12:00:00Z`));
}

export const faWeekLabel = (weekKey: string) => `هفته‌ی ${faDayLabel(weekKey)}`;

// ── Bots and paths we don't count ────────────────────────────────────

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|preview|monitor|curl|wget|python-requests|axios|okhttp|semrush|ahrefs|dataprovider|screaming/i;

export const isBot = (userAgent: string | null) => !!userAgent && BOT.test(userAgent);

/** The admin panel is the shop owner at work, not a visitor. */
export const isCountedPath = (path: string) =>
  path.startsWith("/") && !path.startsWith("/admin") && !path.startsWith("/api");

/** Query strings and fragments would shatter the "top pages" list. */
export function normalisePath(raw: string): string {
  const path = raw.split("#")[0].split("?")[0].trim();
  if (!path.startsWith("/")) return "/";
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed.slice(0, 300) || "/";
}

// ── Keeping the table small ──────────────────────────────────────────

const KEEP_RAW_DAYS = 90;
/** Pruning walks the table, so it runs at most once an hour per process. */
const PRUNE_EVERY_MS = 60 * 60_000;
let lastPrune = 0;

/**
 * Roll weeks older than 90 days into `VisitWeek` and delete their raw rows.
 * Runs inline on write (throttled) so the shop needs no cron for it.
 */
export async function pruneVisits(now: Date = new Date()) {
  if (now.getTime() - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = now.getTime();

  const cutoff = shiftDay(tehranDay(now), -KEEP_RAW_DAYS);
  const stale = await db.pageView.findMany({
    where: { day: { lt: cutoff } },
    select: { weekKey: true, visitorId: true },
  });
  if (stale.length === 0) return;

  const byWeek = new Map<string, { views: number; visitors: Set<string> }>();
  for (const row of stale) {
    let bucket = byWeek.get(row.weekKey);
    if (!bucket) byWeek.set(row.weekKey, (bucket = { views: 0, visitors: new Set() }));
    bucket.views++;
    bucket.visitors.add(row.visitorId);
  }

  for (const [weekKey, bucket] of byWeek) {
    // A week can be pruned in two passes (its last days age out later), so the
    // summary accumulates rather than overwrites.
    await db.visitWeek.upsert({
      where: { weekKey },
      create: { weekKey, views: bucket.views, visitors: bucket.visitors.size },
      update: {
        views: { increment: bucket.views },
        visitors: { increment: bucket.visitors.size },
      },
    });
  }

  await db.pageView.deleteMany({ where: { day: { lt: cutoff } } });
}

// ── Reading the numbers back ─────────────────────────────────────────

export type WeekStat = { weekKey: string; views: number; visitors: number };

/** Views and unique visitors for each of the given weeks. */
export async function statsForWeeks(weekKeys: string[]): Promise<WeekStat[]> {
  const [rows, summaries] = await Promise.all([
    db.pageView.findMany({
      where: { weekKey: { in: weekKeys } },
      select: { weekKey: true, visitorId: true },
    }),
    db.visitWeek.findMany({ where: { weekKey: { in: weekKeys } } }),
  ]);

  const live = new Map<string, { views: number; visitors: Set<string> }>();
  for (const r of rows) {
    let bucket = live.get(r.weekKey);
    if (!bucket) live.set(r.weekKey, (bucket = { views: 0, visitors: new Set() }));
    bucket.views++;
    bucket.visitors.add(r.visitorId);
  }
  const rolled = new Map(summaries.map((s) => [s.weekKey, s]));

  return weekKeys.map((weekKey) => {
    const l = live.get(weekKey);
    const r = rolled.get(weekKey);
    return {
      weekKey,
      views: (l?.views ?? 0) + (r?.views ?? 0),
      visitors: (l?.visitors.size ?? 0) + (r?.visitors ?? 0),
    };
  });
}

/** Percentage change, or null when last week has nothing to compare against. */
export function changePct(now: number, before: number): number | null {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}

/** This week's unique visitors - the dashboard's fifth stat card. */
export async function visitorsThisWeek(): Promise<number> {
  const [week] = await statsForWeeks([weekKeyOf()]);
  return week.visitors;
}
