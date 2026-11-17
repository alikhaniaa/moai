import Link from "next/link";
import { db } from "@/lib/db";
import { faNum } from "@/lib/format";
import {
  changePct, faDayLabel, faWeekLabel, recentDays, recentWeekKeys, statsForWeeks, weekKeyOf,
} from "@/lib/visits";

export const dynamic = "force-dynamic";

const WEEKS = 8;

export default async function AdminVisits() {
  const weekKeys = recentWeekKeys(WEEKS);
  const days = recentDays(7);
  const thisWeek = weekKeyOf();

  const [weeks, dayRows, pathRows] = await Promise.all([
    statsForWeeks(weekKeys),
    db.pageView.findMany({
      where: { day: { in: days } },
      select: { day: true, visitorId: true },
    }),
    db.pageView.groupBy({
      by: ["path"],
      where: { weekKey: thisWeek },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
  ]);

  const current = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2] ?? { views: 0, visitors: 0 };

  // day-by-day for the last week
  const byDay = new Map(days.map((d) => [d, { views: 0, visitors: new Set<string>() }]));
  for (const r of dayRows) {
    const bucket = byDay.get(r.day);
    if (!bucket) continue;
    bucket.views++;
    bucket.visitors.add(r.visitorId);
  }

  // raw slugs mean nothing at a glance, so resolve product pages to their names
  const slugs = pathRows
    .map((r) => r.path.match(/^\/products\/(.+)$/)?.[1])
    .filter((s): s is string => !!s);
  const products = slugs.length
    ? await db.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true, nameFa: true } })
    : [];
  const nameBySlug = new Map(products.map((p) => [p.slug, p.nameFa]));

  const STATIC_NAMES: Record<string, string> = {
    "/": "صفحه اصلی",
    "/products": "فروشگاه",
    "/size-guide": "راهنمای سایز",
    "/checkout": "تسویه حساب",
    "/account": "حساب کاربری",
    "/club": "باشگاه مشتریان",
    "/about": "درباره ما",
    "/contact": "تماس با ما",
    "/faq": "سوالات متداول",
    "/login": "ورود",
    "/track": "پیگیری سفارش",
  };

  const prettyPath = (path: string) => {
    const slug = path.match(/^\/products\/(.+)$/)?.[1];
    if (slug) return nameBySlug.get(slug) ?? path;
    return STATIC_NAMES[path] ?? path;
  };

  const peak = Math.max(1, ...weeks.map((w) => w.views));
  const peakDay = Math.max(1, ...[...byDay.values()].map((d) => d.views));
  const empty = weeks.every((w) => w.views === 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">بازدید</h1>
        <p className="mt-1 text-sm text-ink/68">
          هفته از شنبه تا جمعه حساب می‌شود (به وقت تهران). بازدید پنل مدیریت و
          ربات‌های موتور جستجو شمرده نمی‌شوند.
        </p>
      </div>

      {empty && (
        <p className="rounded-2xl bg-sand-100 px-5 py-4 text-sm leading-7 text-ink/72">
          هنوز بازدیدی ثبت نشده. شمارش از لحظه‌ای شروع می‌شود که این نسخه روی
          سایت بالا بیاید — چند ساعت بعد این صفحه پر می‌شود.
        </p>
      )}

      {/* ── this week ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="بازدیدکننده یکتا (این هفته)"
          value={current.visitors}
          change={changePct(current.visitors, previous.visitors)}
        />
        <StatCard
          label="بازدید کل (این هفته)"
          value={current.views}
          change={changePct(current.views, previous.views)}
        />
      </div>

      {/* ── 8 weeks ── */}
      <div className="card p-6">
        <h2 className="mb-6 font-bold text-sea-900">{faNum(WEEKS)} هفته‌ی گذشته</h2>
        <div className="flex items-end justify-between gap-2 sm:gap-4" style={{ height: 180 }}>
          {weeks.map((w) => (
            <div key={w.weekKey} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-bold text-sea-900">{faNum(w.views)}</span>
              <div
                className={`w-full rounded-t-lg transition-all ${
                  w.weekKey === thisWeek ? "bg-clay-500" : "bg-sea-300"
                }`}
                style={{ height: `${Math.round((w.views / peak) * 120) + 4}px` }}
                title={`${faWeekLabel(w.weekKey)} — ${faNum(w.visitors)} بازدیدکننده`}
              />
              <span className="truncate text-[10px] text-ink/60">{faDayLabel(w.weekKey)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink/60">
          ستون نارنجی هفته‌ی جاری است. عدد بالای هر ستون، بازدید کل آن هفته است.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        {/* ── last 7 days ── */}
        <div className="card overflow-hidden">
          <div className="border-b border-sand-200 px-6 py-4">
            <h2 className="font-bold text-sea-900">۷ روز گذشته</h2>
          </div>
          <ul className="divide-y divide-sand-100">
            {days.map((d) => {
              const bucket = byDay.get(d)!;
              return (
                <li key={d} className="flex items-center gap-4 px-6 py-3 text-sm">
                  <span className="w-24 shrink-0 text-ink/75">{faDayLabel(d)}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-sea-400"
                      style={{ width: `${Math.round((bucket.views / peakDay) * 100)}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-left text-xs text-ink/68">
                    {faNum(bucket.views)} بازدید · {faNum(bucket.visitors.size)} نفر
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── top pages ── */}
        <div className="card overflow-hidden">
          <div className="border-b border-sand-200 px-6 py-4">
            <h2 className="font-bold text-sea-900">پربازدیدترین صفحه‌ها (این هفته)</h2>
          </div>
          <ul className="divide-y divide-sand-100">
            {pathRows.map((r) => (
              <li key={r.path} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <Link
                  href={r.path}
                  className="min-w-0 flex-1 truncate font-semibold text-sea-900 hover:text-clay-600"
                >
                  {prettyPath(r.path)}
                </Link>
                <span className="chip shrink-0 bg-sand-100 text-ink/75">
                  {faNum(r._count.path)}
                </span>
              </li>
            ))}
            {pathRows.length === 0 && (
              <li className="px-6 py-10 text-center text-sm text-ink/60">
                این هفته هنوز بازدیدی ثبت نشده.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, change,
}: {
  label: string; value: number; change: number | null;
}) {
  return (
    <div className="card p-6">
      <div className="text-xs font-semibold text-ink/68">{label}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="font-display text-4xl font-black text-sea-900">{faNum(value)}</span>
        {change === null ? (
          <span className="chip bg-sea-100 text-sea-700">هفته‌ی اول</span>
        ) : (
          <span
            className={`chip ${
              change > 0
                ? "bg-sea-100 text-sea-700"
                : change < 0
                  ? "bg-red-50 text-red-600"
                  : "bg-sand-100 text-ink/68"
            }`}
          >
            {change > 0 ? "▲" : change < 0 ? "▼" : "="} ٪{faNum(Math.abs(change))} نسبت به هفته‌ی قبل
          </span>
        )}
      </div>
    </div>
  );
}
