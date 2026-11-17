import { db } from "@/lib/db";
import { toman, faNum } from "@/lib/format";
import { saveShipping, deleteShipping } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminShipping() {
  const methods = await db.shippingMethod.findMany({ orderBy: { sort: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">روش‌های ارسال</h1>
        <p className="mt-1 text-sm text-ink/68">
          گزینه‌هایی که مشتری هنگام تسویه حساب بین آن‌ها انتخاب می‌کند.
        </p>
      </div>

      <form action={saveShipping} className="card space-y-5 p-7">
        <h2 className="font-bold text-sea-900">روش جدید</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">نام *</label>
            <input name="nameFa" required placeholder="پست پیشتاز" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">هزینه (تومان)</label>
            <input name="cost" type="number" dir="ltr" defaultValue={80000} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">
              رایگان از (۰ = هرگز)
            </label>
            <input name="freeFrom" type="number" dir="ltr" defaultValue={0} className="input" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">زمان تحویل</label>
            <input name="estimatedDays" placeholder="۳ تا ۵ روز کاری" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">توضیح</label>
            <input name="description" placeholder="ارسال به سراسر ایران" className="input" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">ترتیب</label>
            <input name="sort" type="number" dir="ltr" defaultValue={0} className="input !w-28" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 pb-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-clay-500" />
            فعال
          </label>
        </div>
        <button className="btn btn-primary">افزودن روش ارسال</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {methods.map((m) => (
          <div key={m.id} className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sea-900">{m.nameFa}</h3>
                  <span className={`chip ${m.active ? "bg-sea-100 text-sea-700" : "bg-sand-200 text-ink/68"}`}>
                    {m.active ? "فعال" : "غیرفعال"}
                  </span>
                </div>
                {m.description && <p className="mt-1 text-sm text-ink/75">{m.description}</p>}
                {m.estimatedDays && <p className="mt-1 text-xs text-ink/62">{m.estimatedDays}</p>}
                {m.freeFrom > 0 && (
                  <p className="mt-1 text-xs text-sea-600">
                    رایگان برای خرید بالای {toman(m.freeFrom)}
                  </p>
                )}
              </div>
              <div className="text-left">
                <div className="price-lg text-sea-900">
                  {m.cost === 0 ? "پس‌کرایه" : toman(m.cost)}
                </div>
                <div className="mt-1 text-xs text-ink/60">ترتیب: {faNum(m.sort)}</div>
              </div>
            </div>
            <form action={deleteShipping} className="mt-4">
              <input type="hidden" name="id" value={m.id} />
              <button className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                حذف
              </button>
            </form>
          </div>
        ))}
        {methods.length === 0 && (
          <div className="card p-12 text-center text-ink/60 md:col-span-2">
            هنوز روش ارسالی تعریف نشده — تا زمانی که اضافه نکنی، هزینه ارسال صفر
            در نظر گرفته می‌شود.
          </div>
        )}
      </div>
    </div>
  );
}
