import { db } from "@/lib/db";
import { tierOf } from "@/lib/club";
import { getClubTiers } from "@/lib/club-data";
import { faNum, faDate, toman } from "@/lib/format";

export default async function AdminUsers() {
  const [users, tiers] = await Promise.all([
    db.user.findMany({
      include: {
        // This page reports purchases, not checkout attempts. Unpaid orders
        // must not inflate either the order count or the customer's spend.
        orders: { where: { status: { in: ["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"] } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getClubTiers(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">کاربران</h1>
        <p className="mt-1 text-sm text-ink/68">{faNum(users.length)} عضو باشگاه موآی</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 text-xs text-ink/68">
              <tr>
                <th className="px-6 py-3 text-right font-semibold">کاربر</th>
                <th className="px-4 py-3 text-right font-semibold">نقش</th>
                <th className="px-4 py-3 text-right font-semibold">سطح باشگاه</th>
                <th className="px-4 py-3 text-right font-semibold">امتیاز</th>
                <th className="px-4 py-3 text-right font-semibold">سفارش‌ها</th>
                <th className="px-4 py-3 text-right font-semibold">مجموع خرید</th>
                <th className="px-4 py-3 text-right font-semibold">عضویت</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const tier = tierOf(u.points, tiers);
                const spent = u.orders.reduce((s, o) => s + o.total, 0);
                return (
                  <tr key={u.id} className="border-t border-sand-100">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-sea-900">{u.name ?? "—"}</div>
                      <div className="text-xs text-ink/60" dir="ltr">{u.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "ADMIN" ? (
                        <span className="chip bg-sea-800 text-sand-50">مدیر</span>
                      ) : (
                        <span className="text-ink/68">مشتری</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tier.emoji} {tier.nameFa}
                    </td>
                    <td className="px-4 py-3 font-semibold">{faNum(u.points)}</td>
                    <td className="px-4 py-3">{faNum(u.orders.length)}</td>
                    <td className="px-4 py-3">{spent > 0 ? toman(spent) : "—"}</td>
                    <td className="px-4 py-3 text-ink/68">{faDate(u.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
