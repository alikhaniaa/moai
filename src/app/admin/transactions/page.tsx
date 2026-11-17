import Link from "next/link";
import { db } from "@/lib/db";
import { toman, faNum, faDate, faTime, orderCode } from "@/lib/format";

/**
 * The part of a search term that is safe to hand to a LIKE-backed filter.
 *
 * Prisma's SQLite connector emits a bare `LIKE ?` with no ESCAPE clause, so a
 * `%` or `_` typed into the box is a wildcard, not a character - «%» alone
 * would match every row and report the whole table as search hits. Nothing we
 * actually search by (transaction ids, order codes, phone numbers, Persian
 * names) contains either, so they are simply dropped.
 */
const likeSafe = (q: string) => q.replace(/[%_]/g, "");

/** Next hands back an array when a key repeats; take the first and move on. */
const oneParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dynamic = "force-dynamic";

/** How many rows the unfiltered list shows before it starts hiding history. */
const RECENT_LIMIT = 500;

const STATUS_FA: Record<string, string> = {
  PENDING: "ناتمام",
  SETTLEMENT_PENDING: "در انتظار تسویه",
  PAID: "موفق",
  FAILED: "ناموفق",
  CANCELLED: "انصراف",
  MISMATCH: "مغایرت مبلغ",
  REVERSED: "برگشت خورده",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-sand-200 text-ink/75",
  PAID: "bg-sea-100 text-sea-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gold/15 text-clay-700",
  MISMATCH: "bg-red-100 text-red-700",
  REVERSED: "bg-sand-300 text-ink/82",
};

export default async function AdminTransactions({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const { q } = (await searchParams) ?? {};
  const query = oneParam(q)?.trim().replace(/^#/, "");
  const like = query ? likeSafe(query) : "";

  const [payments, salesAgg, paidOrderCount] = await Promise.all([
    db.payment.findMany({
      where: query
        ? {
            OR: [
              // resNum is the transactionId we send اسنپ‌پی; refNum and traceNo
              // are what came back. One row each, so an exact match.
              { resNum: query },
              { refNum: query },
              { traceNo: query },
              ...(like ? [{ order: { fullName: { contains: like } } }] : []),
            ],
          }
        : {},
      include: { order: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      // A search has to reach the whole table - an id that matched but sat
      // below the last ۵۰۰ rows would look like a transaction we never took.
      take: query ? undefined : RECENT_LIMIT,
    }),
    // All-time totals over every paid order - NOT limited to the 500 rows
    // shown below - so this figure is safe to give to the tax office.
    db.order.aggregate({
      _sum: { total: true, goodsTotal: true },
      where: { status: { in: ["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"] } },
    }),
    db.order.count({ where: { status: { in: ["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"] } } }),
  ]);

  const totalSales = salesAgg._sum.total ?? 0; // Toman actually collected
  const goodsSales = salesAgg._sum.goodsTotal ?? 0; // Toman before discount/shipping

  const paid = payments.filter((p) => p.status === "PAID");
  const revenue = paid.reduce((s, p) => s + p.amountRial / 10, 0);
  const successRate = payments.length ? Math.round((paid.length / payments.length) * 100) : 0;

  // the list is the newest ۵۰۰ and there may well be more behind it - say so
  const capped = !query && payments.length === RECENT_LIMIT;

  // group by Persian day
  const groups = new Map<string, typeof payments>();
  for (const p of payments) {
    const day = faDate(p.createdAt);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(p);
  }

  const stats = [
    { label: "درآمد تاییدشده", value: toman(revenue) },
    { label: "تراکنش موفق", value: faNum(paid.length) },
    { label: "کل تراکنش‌ها", value: faNum(payments.length) },
    { label: "نرخ موفقیت", value: `٪${faNum(successRate)}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">تراکنش‌ها</h1>
        <p className="mt-1 text-sm text-ink/68">
          {query
            ? `${faNum(payments.length)} تراکنش با «${query}» پیدا شد.`
            : "تراکنش‌ها به تفکیک روز. روی هر مورد بزن تا جزئیات کامل سفارش و ثبت کد رهگیری را ببینی."}
        </p>
      </div>

      {/* All-time total sales - the number to hand to the tax office */}
      <div className="card border-2 border-clay-500/30 bg-clay-500/5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-clay-700">
              مجموع کل فروش (همه‌ی سفارش‌های پرداخت‌شده — برای محاسبه مالیات)
            </div>
            <div className="mt-2 font-display text-3xl font-black break-words text-clay-600 sm:text-4xl">
              {toman(totalSales)}
            </div>
          </div>
          <div className="text-sm text-ink/68">
            <div>ارزش کالا (قبل از تخفیف): {toman(goodsSales)}</div>
            <div className="mt-1">{faNum(paidOrderCount)} سفارش موفق</div>
          </div>
        </div>
      </div>

      {/* Same plain GET form as صفحه سفارش‌ها, so the shortcut is the same one
          wherever the admin happens to be standing. */}
      <form method="get" className="card flex flex-wrap items-center gap-3 p-4">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="جستجو: شناسه تراکنش اسنپ‌پی یا نام خریدار"
          className="input min-w-0 flex-1 !py-2.5 text-sm"
        />
        <button className="btn btn-primary shrink-0 !px-6 !py-2.5 text-sm">جستجو</button>
        {query && (
          <Link href="/admin/transactions" className="btn btn-ghost shrink-0 !px-5 !py-2.5 text-sm">
            همه تراکنش‌ها
          </Link>
        )}
      </form>

      {/* The four figures describe the recent list as a whole; next to a
          handful of search results they would read as totals of the search,
          which they are not. */}
      {!query && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-6">
              <div className="text-xs font-semibold text-ink/68">{s.label}</div>
              <div className="mt-2 font-display text-3xl font-black text-sea-900">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {capped && (
        <p className="rounded-2xl bg-gold/15 px-5 py-4 text-sm leading-7 font-semibold text-clay-700">
          فقط {faNum(RECENT_LIMIT)} تراکنش آخر این‌جا فهرست شده — تراکنش‌های قدیمی‌تر
          هستند ولی نمایش داده نمی‌شوند. با شناسه تراکنش یا نام خریدار جستجو کن تا در
          کل تراکنش‌ها گشته شود.
        </p>
      )}

      {[...groups.entries()].map(([day, list]) => {
        const dayRevenue = list.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountRial / 10, 0);
        return (
          <div key={day} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-sand-200 pb-2">
              <h2 className="font-display text-xl font-bold text-sea-900">{day}</h2>
              <span className="text-sm font-semibold text-sea-700">
                {faNum(list.length)} تراکنش · {toman(dayRevenue)}
              </span>
            </div>
            <div className="card divide-y divide-sand-100 overflow-hidden">
              {list.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/orders/${p.orderId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-sand-50 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="shrink-0 font-mono text-xs font-bold text-ink/50" dir="ltr">
                      {faTime(p.createdAt)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-sea-900">{p.order.user.name ?? p.order.fullName ?? "—"}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink/45">
                        <span dir="ltr">#{orderCode(p.orderId)}</span>
                        <span
                          className={
                            p.provider === "DIGIPAY"
                              ? "text-[#003eff]"
                              : p.provider === "SNAPPPAY"
                                ? "text-[#0062c4]"
                                : "text-ink/45"
                          }
                        >
                          {p.provider === "DIGIPAY"
                            ? "دیجی‌پی"
                            : p.provider === "SNAPPPAY"
                              ? "اسنپ‌پی"
                              : "سپ"}
                        </span>
                        {/* verified but not captured - someone has to settle it by hand */}
                        {p.provider === "SNAPPPAY" && p.status === "PAID" && !p.settledAt && (
                          <span className="text-clay-600">تسویه‌نشده</span>
                        )}
                      </div>
                      {/* the id the gateway knows this attempt by - the one the
                          admin pastes into the box above */}
                      <div className="mt-0.5 truncate text-xs text-ink/45">
                        شناسه تراکنش:{" "}
                        <span className="font-mono font-semibold text-ink/68" dir="ltr">{p.resNum}</span>
                      </div>
                    </div>
                  </div>
                  {/* the amount sits above the badge on a phone, side by side once
                      there is room - either way this half never shrinks the name */}
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="whitespace-nowrap font-semibold text-sea-900">{toman(p.amountRial / 10)}</span>
                    <span className={`chip shrink-0 whitespace-nowrap ${STATUS_COLOR[p.status] ?? "bg-sand-100"}`}>
                      {STATUS_FA[p.status] ?? p.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {payments.length === 0 && (
        <div className="card p-16 text-center text-ink/50">
          {query ? (
            <>
              <p className="font-bold text-sea-900">تراکنشی با «{query}» پیدا نشد.</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7">
                شناسه تراکنش باید کامل و بدون فاصله وارد شود. اگر دنبال یک سفارش
                می‌گردی، همان شناسه را در{" "}
                <Link href="/admin/orders" className="font-semibold text-clay-600 hover:underline">
                  صفحه سفارش‌ها
                </Link>{" "}
                هم می‌شود جستجو کرد.
              </p>
              <Link href="/admin/transactions" className="btn btn-ghost mt-5 !px-5 !py-2.5 text-sm">
                همه تراکنش‌ها
              </Link>
            </>
          ) : (
            "هنوز تراکنشی ثبت نشده."
          )}
        </div>
      )}
    </div>
  );
}
