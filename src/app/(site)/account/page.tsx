import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { tierOf, nextTier } from "@/lib/club";
import { getClubTiers } from "@/lib/club-data";
import { toman, faNum, faDate, ORDER_STATUS_FA, ORDER_STATUS_COLOR } from "@/lib/format";
import {
  updateAddress,
  setPassword,
  logout,
  requestSnapppayUpdate,
  requestSnapppayCancel,
  withdrawSnapppayRequest,
} from "./actions";
import { PROVINCES } from "@/lib/provinces";
import SnappPayPlan from "@/components/SnappPayPlan";
import SnappPayRequestPanel from "@/components/account/SnappPayRequestPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "حساب کاربری" };

const REQUEST_BANNERS: Record<string, { tone: string; text: string }> = {
  created: { tone: "bg-sea-100 text-sea-700", text: "درخواست شما ثبت شد و پس از بررسی فروشگاه نتیجه در همین صفحه نمایش داده می‌شود." },
  withdrawn: { tone: "bg-sand-100 text-ink/75", text: "درخواست شما پس گرفته شد و هیچ تغییری در سفارش ایجاد نشد." },
  pending: { tone: "bg-gold/15 text-clay-700", text: "برای این سفارش یک درخواست باز وجود دارد؛ ابتدا همان درخواست باید بررسی یا پس گرفته شود." },
  nochange: { tone: "bg-gold/15 text-clay-700", text: "تعداد هیچ کالایی کم نشده بود؛ درخواستی ثبت نشد." },
  emptycart: { tone: "bg-gold/15 text-clay-700", text: "برای حذف همه‌ی کالاها از گزینه «لغو کامل سفارش» استفاده کنید." },
  notready: { tone: "bg-gold/15 text-clay-700", text: "پرداخت اسنپ‌پی این سفارش هنوز آماده تغییر یا لغو نیست." },
  closed: { tone: "bg-gold/15 text-clay-700", text: "در وضعیت فعلی این سفارش امکان ثبت درخواست تازه وجود ندارد." },
  noteligible: { tone: "bg-red-50 text-red-700", text: "این سفارش با درگاه اعتباری اسنپ‌پی پرداخت نشده است." },
  notfound: { tone: "bg-red-50 text-red-700", text: "درخواست یا سفارش موردنظر پیدا نشد." },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ snappRequest?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const { snappRequest } = (await searchParams) ?? {};
  const requestBanner = snappRequest ? REQUEST_BANNERS[snappRequest] : undefined;

  const [orders, tiers] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
        snappPayChangeRequests: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getClubTiers(),
  ]);

  const tier = tierOf(user.points, tiers);
  const next = nextTier(user.points, tiers);
  const progress = next
    ? Math.min(100, Math.round((user.points / next.min) * 100))
    : 100;

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">سلام دوباره…</div>
          <h1 className="font-display text-4xl font-bold text-sea-900 md:text-6xl">
            {user.name || "دوستِ موآی"}
          </h1>
        </div>
        <div className="flex gap-3">
          {user.role === "ADMIN" && (
            <Link href="/admin" className="btn btn-dark">پنل مدیریت</Link>
          )}
          <form action={logout}>
            <button className="btn btn-ghost">خروج</button>
          </form>
        </div>
      </div>

      {requestBanner && (
        <div className={`mt-7 rounded-2xl px-5 py-4 text-sm leading-7 ${requestBanner.tone}`}>
          {requestBanner.text}
        </div>
      )}

      {/* club status */}
      <div className={`mt-10 rounded-3xl bg-gradient-to-l ${tier.color} p-7 md:p-9`}>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-ink/75">سطح باشگاه</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-4xl">{tier.emoji}</span>
              <span className="font-display text-4xl font-black text-sea-900">{tier.nameFa}</span>
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-ink/75">امتیاز شما</div>
            <div className="font-display text-4xl font-black text-clay-600">{faNum(user.points)}</div>
          </div>
        </div>
        {next ? (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-semibold text-ink/75">
              <span>تا سطح {next.nameFa} {next.emoji}</span>
              <span>{faNum(Math.max(0, next.min - user.points))} امتیاز مانده</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full bg-clay-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm font-semibold text-sea-800">
            بالاترین سطح باشگاه هستی — مروارید موآی 🫧
          </p>
        )}
        <Link href="/club" className="mt-5 inline-block text-sm font-bold text-sea-800 underline underline-offset-4">
          مزایای باشگاه ←
        </Link>
      </div>

      {/* profile */}
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="card p-7">
          <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">مشخصات و آدرس</h2>
          <form action={updateAddress} className="space-y-3">
            <input name="name" defaultValue={user.name ?? ""} placeholder="نام و نام خانوادگی" className="input" />
            <div className="input bg-sand-100 text-ink/68" dir="ltr">{user.phone}</div>
            <input name="email" type="email" defaultValue={user.email ?? ""} placeholder="ایمیل (اختیاری)" dir="ltr" className="input" />
            <div className="grid grid-cols-2 gap-3">
              <select name="province" defaultValue={user.province ?? ""} className="input">
                <option value="">استان</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input name="city" defaultValue={user.city ?? ""} placeholder="شهر" className="input" />
            </div>
            <input name="address" defaultValue={user.address ?? ""} placeholder="آدرس (خیابان و پلاک)" className="input" />
            <div className="grid grid-cols-2 gap-3">
              <input name="unit" defaultValue={user.unit ?? ""} placeholder="واحد (اختیاری)" className="input" />
              <input name="postalCode" defaultValue={user.postalCode ?? ""} placeholder="کدپستی" dir="ltr" inputMode="numeric" className="input" />
            </div>
            <p className="text-xs text-ink/55">این آدرس هنگام خرید به‌صورت خودکار پر می‌شود.</p>
            <button className="btn btn-dark w-full">ذخیره اطلاعات</button>
          </form>

          <form action={setPassword} className="mt-6 space-y-3 border-t border-sand-200 pt-6">
            <label className="block text-sm font-semibold text-sea-900">
              تنظیم رمز عبور {user.passwordHash ? "(تغییر)" : "(اختیاری)"}
            </label>
            <input
              name="password" type="password" dir="ltr" minLength={6}
              placeholder="حداقل ۶ کاراکتر" className="input"
            />
            <p className="text-xs text-ink/55">
              با تنظیم رمز، اگر پیامک دیر رسید می‌توانی با شماره و رمز وارد شوی.
            </p>
            <button className="btn btn-ghost w-full">ذخیره رمز عبور</button>
          </form>
        </div>

        {/* orders */}
        <div className="card p-7">
          <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">سفارش‌های من</h2>
          {orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink/68">
              هنوز سفارشی نداری.
              <div className="mt-4">
                <Link href="/products" className="btn btn-primary">اولین خرید</Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((o) => (
                <li id={`order-${o.id}`} key={o.id} className="scroll-mt-32 rounded-2xl border border-sand-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink/68" dir="ltr">
                      #{o.id.slice(-8).toUpperCase()}
                    </span>
                    <span className={`chip ${ORDER_STATUS_COLOR[o.status] ?? "bg-sand-100"}`}>
                      {ORDER_STATUS_FA[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm leading-7 text-ink/82">
                    {o.items
                      .map(
                        (i) =>
                          `${i.nameFa}${[i.sizeLabel && `سایز ${i.sizeLabel}`, i.colorName].filter(Boolean).join("، ") ? ` (${[i.sizeLabel && `سایز ${i.sizeLabel}`, i.colorName].filter(Boolean).join("، ")})` : ""} ×${faNum(i.qty)}`
                      )
                      .join("، ")}
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-ink/68">{faDate(o.createdAt)}</span>
                    <span className="font-bold text-sea-900">{toman(o.total)}</span>
                  </div>
                  {o.paymentMethod === "SNAPPPAY" && (
                    <SnappPayPlan total={o.total} approvedAt={o.snapppayApprovedAt} compact />
                  )}
                  {o.status === "AWAITING_PAYMENT" && (
                    <Link
                      href={`/checkout/pay/${o.id}`}
                      className="btn btn-primary mt-3 w-full !py-2.5 text-xs"
                    >
                      پرداخت این سفارش
                    </Link>
                  )}
                  {o.status === "AWAITING_SNAPPPAY" && (
                    <Link
                      href={`/checkout/snapppay/${o.id}`}
                      className="btn btn-primary mt-3 w-full !py-2.5 text-xs"
                    >
                      ادامه‌ی ثبت‌نام اسنپ‌پی در واتس‌اپ
                    </Link>
                  )}
                  {o.status === "AWAITING_TRANSFER" && (
                    <Link
                      href={`/checkout/transfer/${o.id}`}
                      className="btn btn-primary mt-3 w-full !py-2.5 text-xs"
                    >
                      شماره کارت و ارسال رسید
                    </Link>
                  )}
                  {o.paymentMethod === "SNAPPPAY_IPG" &&
                    ["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"].includes(o.status) &&
                    o.payments.some(
                      (p) => p.provider === "SNAPPPAY" && p.status === "PAID" && p.token && p.settledAt
                    ) && (
                      <SnappPayRequestPanel
                        orderId={o.id}
                        items={o.items.map((item) => ({
                          id: item.id,
                          nameFa: item.nameFa,
                          sizeLabel: item.sizeLabel,
                          colorName: item.colorName,
                          unitPrice: item.unitPrice,
                          qty: item.qty,
                        }))}
                        discount={o.discount}
                        shippingCost={o.shippingCost}
                        total={o.total}
                        pendingRequest={(() => {
                          const pending = o.snappPayChangeRequests.find((request) => request.status === "PENDING");
                          return pending
                            ? {
                                id: pending.id,
                                kind: pending.kind,
                                summary: pending.summary,
                                createdAtLabel: faDate(pending.createdAt),
                              }
                            : null;
                        })()}
                        lastRequest={(() => {
                          const last = o.snappPayChangeRequests.find((request) => request.status !== "PENDING");
                          return last
                            ? {
                                status: last.status,
                                kind: last.kind,
                                resolution: last.resolution,
                              }
                            : null;
                        })()}
                        onRequestUpdate={requestSnapppayUpdate}
                        onRequestCancel={requestSnapppayCancel}
                        onWithdraw={withdrawSnapppayRequest}
                      />
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
