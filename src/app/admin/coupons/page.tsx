import { db } from "@/lib/db";
import { toman, faNum, faDate } from "@/lib/format";
import { saveCoupon, deleteCoupon, toggleCoupon } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCoupons({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = (await searchParams) ?? {};
  const coupons = await db.coupon.findMany({
    include: { user: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">کدهای تخفیف</h1>
        <p className="mt-1 text-sm text-ink/68">
          کد عمومی برای همه، یا کد اختصاصی برای یک مشتری خاص.
        </p>
      </div>

      {saved && (
        <p className="rounded-2xl bg-sea-100 px-5 py-3 text-sm font-bold text-sea-700">✓ ذخیره شد.</p>
      )}

      {error === "duplicate" && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          کدی با همین نام از قبل وجود دارد؛ چیزی ذخیره نشد. یک کد دیگر انتخاب کن —
          هر کد باید یکتا باشد.
        </p>
      )}

      {error === "value" && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          کد و مقدار تخفیف هر دو لازم‌اند و مقدار باید بزرگ‌تر از صفر باشد.
        </p>
      )}

      {error === "owner" && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          کاربری با این شماره پیدا نشد؛ کد ذخیره نشد. اول مطمئن شو مشتری با همین
          شماره در سایت ثبت‌نام کرده، یا فیلد شماره را خالی بگذار تا کد عمومی شود.
        </p>
      )}

      <form action={saveCoupon} className="card space-y-5 p-7">
        <h2 className="font-bold text-sea-900">کد جدید</h2>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">کد *</label>
            <input name="code" required dir="ltr" placeholder="SUMMER25" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">نوع</label>
            <select name="type" className="input" defaultValue="PERCENT">
              <option value="PERCENT">درصدی</option>
              <option value="FIXED">مبلغ ثابت (تومان)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">مقدار *</label>
            <input name="value" type="number" required dir="ltr" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">حداقل خرید</label>
            <input name="minSubtotal" type="number" dir="ltr" defaultValue={0} className="input" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">
              مخصوص شماره موبایل
            </label>
            <input name="phone" dir="ltr" placeholder="خالی = عمومی" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">سقف کل استفاده</label>
            <input name="maxUses" type="number" min={1} dir="ltr" placeholder="نامحدود" className="input" />
            <p className="mt-1 text-[11px] leading-5 text-ink/55">
              خالی = نامحدود. فقط سفارش‌های پرداخت‌شده شمرده می‌شوند.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">
              سقف هر کاربر
            </label>
            <input name="perUserLimit" type="number" min={0} dir="ltr" defaultValue={1} className="input" />
            <p className="mt-1 text-[11px] leading-5 text-clay-600">
              ۰ یعنی <b>نامحدود</b> — هر مشتری هر چند بار بخواهد.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-sea-900">از</label>
              <input name="startsAt" type="date" dir="ltr" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-sea-900">تا</label>
              <input name="endsAt" type="date" dir="ltr" className="input" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-clay-500" />
            فعال
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="freeShipping" className="h-5 w-5 accent-clay-500" />
            ارسال رایگان هم بدهد
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="blockInstallments" className="h-5 w-5 accent-clay-500" />
            روی پرداخت قسطی اعمال نشود
          </label>
        </div>

        <p className="-mt-2 text-xs leading-6 text-ink/60">
          «روی پرداخت قسطی اعمال نشود» یعنی اگر مشتری اسنپ‌پی یا دیجی‌پی را انتخاب
          کند، این کد پذیرفته نمی‌شود. کارت به کارت و درگاه سپ شامل این محدودیت
          نیستند، چون مبلغ کامل همان لحظه پرداخت می‌شود.
        </p>

        <button className="btn btn-primary">ایجاد کد</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 text-xs text-ink/68">
              <tr>
                <th className="px-6 py-3 text-right font-semibold">کد</th>
                <th className="px-4 py-3 text-right font-semibold">تخفیف</th>
                <th className="px-4 py-3 text-right font-semibold">شرایط</th>
                <th className="px-4 py-3 text-right font-semibold">استفاده</th>
                <th className="px-4 py-3 text-right font-semibold">بازه</th>
                <th className="px-4 py-3 text-right font-semibold">وضعیت</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-sand-100">
                  <td className="px-6 py-3">
                    <span className="font-bold text-sea-900" dir="ltr">{c.code}</span>
                    {c.user && (
                      <div className="text-xs text-clay-600" dir="ltr">{c.user.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-clay-600">
                    {c.type === "PERCENT" ? `٪${faNum(c.value)}` : toman(c.value)}
                    {c.freeShipping && <div className="text-xs text-sea-600">+ ارسال رایگان</div>}
                    {!c.allowInstallments && (
                      <div className="text-xs font-semibold text-clay-600">بدون پرداخت قسطی</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/75">
                    {c.minSubtotal > 0 ? `حداقل ${toman(c.minSubtotal)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink/82">
                    {faNum(c._count.orders)}
                    {c.maxUses ? ` / ${faNum(c.maxUses)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/68">
                    {c.startsAt ? faDate(c.startsAt) : "همیشه"} — {c.endsAt ? faDate(c.endsAt) : "بی‌پایان"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${c.active ? "bg-sea-100 text-sea-700" : "bg-sand-200 text-ink/68"}`}>
                      {c.active ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <form action={toggleCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full bg-sand-200 px-4 py-1.5 text-xs font-bold text-ink/82 hover:bg-sand-300">
                          {c.active ? "توقف" : "فعال"}
                        </button>
                      </form>
                      <form action={deleteCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                          حذف
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-ink/60">
                    هنوز کد تخفیفی ساخته نشده.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
