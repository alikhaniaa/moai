import Link from "next/link";
import { db } from "@/lib/db";
import { toman, faNum, faDate, ORDER_STATUS_FA, ORDER_STATUS_COLOR } from "@/lib/format";
import { visitorsThisWeek } from "@/lib/visits";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // "sales" = orders that were actually paid (paid → shipped → delivered).
  // Excludes unpaid/awaiting and cancelled, so the figure is safe to hand to
  // the tax office. `total` is what the buyer paid (Toman).
  const PAID = ["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"];

  const [orders, salesAgg, usersCount, productsCount, lowStock, visitors] =
    await Promise.all([
      // only the six the table shows - the totals come from the aggregate,
      // so this page stays fast no matter how many orders accumulate
      db.order.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.order.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: { in: PAID } },
      }),
      db.user.count(),
      db.product.count(),
      db.product.findMany({ where: { stock: { lte: 5 } }, orderBy: { stock: "asc" } }),
      visitorsThisWeek(),
    ]);

  const paidOrders = { length: salesAgg._count };
  const totalSales = salesAgg._sum.total ?? 0;

  const stats = [
    { label: "مجموع فروش (پرداخت‌شده)", value: toman(totalSales), accent: "text-clay-600", href: "/admin/orders" },
    { label: "سفارش موفق", value: faNum(paidOrders.length), accent: "text-sea-700", href: "/admin/orders" },
    { label: "کاربران", value: faNum(usersCount), accent: "text-sea-700", href: "/admin/users" },
    { label: "محصولات", value: faNum(productsCount), accent: "text-sea-700", href: "/admin/products" },
    { label: "بازدید این هفته", value: faNum(visitors), accent: "text-sea-700", href: "/admin/visits" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">داشبورد</h1>
        <p className="mt-1 text-sm text-ink/68">نمای کلی فروشگاه موآی</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card p-6 transition-colors hover:border-sand-300"
          >
            <div className="text-xs font-semibold text-ink/68">{s.label}</div>
            <div className={`mt-2 font-display text-3xl font-black ${s.accent}`}>{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        {/* recent orders */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
            <h2 className="font-bold text-sea-900">آخرین سفارش‌ها</h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-clay-600 hover:underline">
              همه سفارش‌ها ←
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-100 text-xs text-ink/68">
                <tr>
                  <th className="px-6 py-3 text-right font-semibold">کد</th>
                  <th className="px-4 py-3 text-right font-semibold">مشتری</th>
                  <th className="px-4 py-3 text-right font-semibold">مبلغ</th>
                  <th className="px-4 py-3 text-right font-semibold">وضعیت</th>
                  <th className="px-4 py-3 text-right font-semibold">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-sand-100">
                    <td className="px-6 py-3 font-bold text-ink/75" dir="ltr">
                      #{o.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">{o.fullName || o.user.phone}</td>
                    <td className="px-4 py-3 font-semibold">{toman(o.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${ORDER_STATUS_COLOR[o.status] ?? "bg-sand-100"}`}>
                        {ORDER_STATUS_FA[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/68">{faDate(o.createdAt)}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-ink/60">
                      هنوز سفارشی ثبت نشده.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* low stock */}
        <div className="card overflow-hidden">
          <div className="border-b border-sand-200 px-6 py-4">
            <h2 className="font-bold text-sea-900">موجودی رو به اتمام</h2>
          </div>
          <ul className="divide-y divide-sand-100">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-3 text-sm">
                <Link href={`/admin/products/${p.id}`} className="font-semibold text-sea-900 hover:text-clay-600">
                  {p.nameFa}
                </Link>
                <span className={`chip ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-gold/15 text-clay-700"}`}>
                  {p.stock === 0 ? "تمام شد" : `${faNum(p.stock)} عدد`}
                </span>
              </li>
            ))}
            {lowStock.length === 0 && (
              <li className="px-6 py-10 text-center text-sm text-ink/60">همه‌چیز به‌اندازه هست ✌️</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
