import { db } from "@/lib/db";
import { faNum, faDate } from "@/lib/format";
import { saveCampaign, deleteCampaign, toggleCampaign } from "../actions";

export const dynamic = "force-dynamic";

const isLive = (c: { active: boolean; startsAt: Date | null; endsAt: Date | null }) => {
  const now = Date.now();
  if (!c.active) return false;
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return false;
  return true;
};

export default async function AdminCampaigns() {
  const [campaigns, categories, products] = await Promise.all([
    db.campaign.findMany({
      include: { category: true, product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.category.findMany(),
    db.product.findMany({ orderBy: { nameFa: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">تخفیف‌ها و پیشنهادها</h1>
        <p className="mt-1 text-sm text-ink/68">
          یک درصد تخفیف روی کل سایت، یک دسته‌بندی، یا یک محصول بگذار. قیمت‌ها بلافاصله
          در فروشگاه به‌روز می‌شوند و اگر محصولی قیمت حراج جدا داشته باشد، همیشه
          ارزان‌ترین قیمت به مشتری داده می‌شود.
        </p>
      </div>

      {/* new campaign */}
      <form action={saveCampaign} className="card space-y-5 p-7">
        <h2 className="font-bold text-sea-900">تخفیف جدید</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">عنوان *</label>
            <input name="title" required placeholder="حراج تابستانه" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">درصد تخفیف *</label>
            <input name="percent" type="number" min={1} max={90} required dir="ltr" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">شامل</label>
            <select name="scope" className="input" defaultValue="SITE">
              <option value="SITE">کل سایت</option>
              <option value="CATEGORY">یک دسته‌بندی</option>
              <option value="PRODUCT">یک محصول</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">دسته‌بندی</label>
            <select name="categoryId" className="input" defaultValue="">
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameFa}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">محصول</label>
            <select name="productId" className="input" defaultValue="">
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nameFa}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">از تاریخ</label>
            <input name="startsAt" type="date" dir="ltr" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">تا تاریخ</label>
            <input name="endsAt" type="date" dir="ltr" className="input" />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
          <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-clay-500" />
          همین حالا فعال باشد
        </label>

        <button className="btn btn-primary">ایجاد تخفیف</button>
      </form>

      {/* list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 text-xs text-ink/68">
              <tr>
                <th className="px-6 py-3 text-right font-semibold">عنوان</th>
                <th className="px-4 py-3 text-right font-semibold">تخفیف</th>
                <th className="px-4 py-3 text-right font-semibold">شامل</th>
                <th className="px-4 py-3 text-right font-semibold">بازه</th>
                <th className="px-4 py-3 text-right font-semibold">وضعیت</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-sand-100">
                  <td className="px-6 py-3 font-semibold text-sea-900">{c.title}</td>
                  <td className="px-4 py-3 font-bold text-clay-600">٪{faNum(c.percent)}</td>
                  <td className="px-4 py-3 text-ink/82">
                    {c.scope === "SITE" && "کل سایت"}
                    {c.scope === "CATEGORY" && (c.category?.nameFa ?? "—")}
                    {c.scope === "PRODUCT" && (c.product?.nameFa ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/68">
                    {c.startsAt ? faDate(c.startsAt) : "همیشه"} — {c.endsAt ? faDate(c.endsAt) : "بی‌پایان"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${isLive(c) ? "bg-sea-100 text-sea-700" : "bg-sand-200 text-ink/68"}`}>
                      {isLive(c) ? "در حال اجرا" : c.active ? "خارج از بازه" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <form action={toggleCampaign}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full bg-sand-200 px-4 py-1.5 text-xs font-bold text-ink/82 hover:bg-sand-300">
                          {c.active ? "توقف" : "فعال‌سازی"}
                        </button>
                      </form>
                      <form action={deleteCampaign}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                          حذف
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-ink/60">
                    هنوز تخفیفی تعریف نشده.
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
