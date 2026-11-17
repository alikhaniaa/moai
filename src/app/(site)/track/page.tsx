import { db } from "@/lib/db";
import { toman, faNum, faDate, orderCode, ORDER_STATUS_FA } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "پیگیری سفارش" };

// order-status journey shown as a progress track
const STEPS = [
  { key: "AWAITING_PAYMENT", label: "ثبت سفارش", icon: "📝" },
  { key: "PAID", label: "پرداخت شد", icon: "💳" },
  { key: "DISPATCHING", label: "در حال آماده سازی", icon: "📦" },
  { key: "SHIPPED", label: "ارسال شد", icon: "🚚" },
  { key: "DELIVERED", label: "تحویل شد", icon: "🎉" },
];
const STEP_INDEX: Record<string, number> = {
  // an order awaiting manual confirmation sits at the same first step
  AWAITING_PAYMENT: 0, AWAITING_SNAPPPAY: 0, AWAITING_TRANSFER: 0,
  PAID: 1, DISPATCHING: 2, SHIPPED: 3, DELIVERED: 4,
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; phone?: string }>;
}) {
  const { code, phone } = await searchParams;
  const clean = code?.trim().toUpperCase();
  const cleanPhone = phone?.trim();

  let order = null;
  let notFound = false;

  if (clean && cleanPhone) {
    // match the last-8 code against orders belonging to this phone
    const candidates = await db.order.findMany({
      where: { phone: cleanPhone },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    order = candidates.find((o) => orderCode(o.id) === clean) ?? null;
    notFound = !order;
  }

  const cancelled = order?.status === "CANCELLED";
  const stepIdx = order ? STEP_INDEX[order.status] ?? 0 : 0;

  return (
    <section className="mx-auto max-w-2xl px-6 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="eyebrow">کجاست سفارشم؟</div>
      <h1 className="font-display text-4xl font-bold text-sea-900 md:text-6xl">پیگیری سفارش</h1>
      <p className="mt-3 text-sm leading-7 text-ink/68">
        کد پیگیری سفارش و شماره موبایلی که هنگام خرید وارد کردی را وارد کن.
      </p>

      <form className="card mt-8 space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">کد پیگیری</label>
            <input name="code" dir="ltr" defaultValue={code ?? ""} placeholder="مثلاً A1B2C3D4" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">شماره موبایل</label>
            <input name="phone" dir="ltr" inputMode="tel" defaultValue={phone ?? ""} placeholder="09xxxxxxxxx" className="input" />
          </div>
        </div>
        <button className="btn btn-primary w-full">پیگیری</button>
      </form>

      {notFound && (
        <p className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-center text-sm text-red-700">
          سفارشی با این مشخصات پیدا نشد. کد و شماره را دوباره بررسی کن.
        </p>
      )}

      {order && (
        <div className="card mt-8 p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-ink/55">کد پیگیری</div>
              <div className="font-display text-2xl font-black text-sea-900" dir="ltr">#{orderCode(order.id)}</div>
            </div>
            <div className="text-left">
              <div className="text-xs text-ink/55">تاریخ ثبت</div>
              <div className="font-semibold text-sea-900">{faDate(order.createdAt)}</div>
            </div>
          </div>

          {cancelled ? (
            <p className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-center text-sm font-semibold text-red-700">
              این سفارش لغو شده است. اگر سوالی داری در واتس‌اپ با ما در تماس باش.
            </p>
          ) : (
            <div className="mt-8 flex items-center justify-between">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex flex-1 flex-col items-center text-center">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-full text-lg transition-colors ${
                      i <= stepIdx ? "bg-clay-500 text-sand-50" : "bg-sand-200 text-ink/40"
                    }`}
                  >
                    {s.icon}
                  </div>
                  <span className={`mt-2 text-xs font-semibold ${i <= stepIdx ? "text-sea-900" : "text-ink/40"}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {order.trackingCode && (
            <div className="mt-6 rounded-2xl bg-sea-100 px-5 py-4 text-center text-sm text-sea-800">
              کد رهگیری تیپاکس:{" "}
              <span className="font-bold" dir="ltr">{order.trackingCode}</span>
              <div className="mt-1 text-xs text-sea-700">
                برای رهگیری مرسوله، این کد را در سایت تیپاکس وارد کن.
              </div>
            </div>
          )}

          <ul className="mt-6 space-y-2 border-t border-sand-200 pt-4 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span className="text-ink/82">
                  {i.nameFa}
                  {i.sizeLabel && <span className="text-sea-700"> — سایز {i.sizeLabel}</span>}
                {i.colorName && <span className="text-clay-700"> — رنگ {i.colorName}</span>}
                  {" "}× {faNum(i.qty)}
                </span>
                <span className="font-semibold text-sea-900">{toman(i.unitPrice * i.qty)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-sand-100 pt-2">
              <span className="font-bold text-sea-900">جمع کل</span>
              <span className="price-lg text-sea-900">{toman(order.total)}</span>
            </li>
          </ul>

          <p className="mt-4 text-center text-xs text-ink/50">
            وضعیت فعلی: <b className="text-sea-900">{ORDER_STATUS_FA[order.status] ?? order.status}</b>
          </p>
        </div>
      )}
    </section>
  );
}
