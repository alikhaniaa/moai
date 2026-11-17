import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { toman, faNum } from "@/lib/format";
import { deleteProduct, bulkPriceChange } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ bulk?: string }>;
}) {
  const { bulk } = await searchParams;
  const [products, categories] = await Promise.all([
    db.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
    db.category.findMany(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-sea-900">محصولات</h1>
          <p className="mt-1 text-sm text-ink/68">{faNum(products.length)} محصول</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          + محصول جدید
        </Link>
      </div>

      {bulk && (
        <p className="rounded-2xl bg-sea-100 px-5 py-3 text-sm font-bold text-sea-700">
          ✓ قیمت‌ها به‌روز شد.
        </p>
      )}

      {/* bulk price tool */}
      <details className="card p-6">
        <summary className="cursor-pointer font-bold text-sea-900">
          تغییر گروهی قیمت‌ها (یک دسته یا کل محصولات)
        </summary>
        <form action={bulkPriceChange} className="mt-5 grid items-end gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">دسته‌بندی</label>
            <select name="categoryId" className="input" defaultValue="">
              <option value="">همه محصولات</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameFa}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">کار</label>
            <select name="mode" className="input" defaultValue="sale">
              <option value="sale">گذاشتن قیمت حراج با ٪ تخفیف</option>
              <option value="list">تغییر قیمت اصلی با ٪</option>
              <option value="clear">حذف همه قیمت‌های حراج</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">درصد</label>
            <input name="percent" type="number" dir="ltr" defaultValue={10} className="input" />
          </div>
          <button className="btn btn-dark">اعمال</button>
        </form>
        <p className="mt-3 text-xs leading-6 text-ink/68">
          برای تخفیف موقت روی کل سایت، معمولاً بهتر است از بخش «تخفیف‌ها» استفاده کنی —
          آن‌جا تاریخ شروع و پایان دارد و قیمت اصلی دست‌نخورده می‌ماند.
        </p>
      </details>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 text-xs text-ink/68">
              <tr>
                <th className="px-6 py-3 text-right font-semibold">محصول</th>
                <th className="px-4 py-3 text-right font-semibold">دسته</th>
                <th className="px-4 py-3 text-right font-semibold">قیمت</th>
                <th className="px-4 py-3 text-right font-semibold">حراج</th>
                <th className="px-4 py-3 text-right font-semibold">موجودی</th>
                <th className="px-4 py-3 text-right font-semibold">ویژه</th>
                <th className="px-4 py-3 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-sand-100">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={p.image}
                        alt=""
                        width={44}
                        height={54}
                        className="h-13 w-11 rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-semibold text-sea-900">{p.nameFa}</div>
                        <div className="text-xs text-ink/60" dir="ltr">/{p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/75">{p.category.nameFa}</td>
                  <td className="px-4 py-3">{toman(p.price)}</td>
                  <td className="px-4 py-3">{p.salePrice ? toman(p.salePrice) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={p.stock <= 5 ? "font-bold text-clay-600" : ""}>{faNum(p.stock)}</span>
                  </td>
                  <td className="px-4 py-3">{p.featured ? "⭐" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="rounded-full bg-sea-100 px-4 py-1.5 text-xs font-bold text-sea-700 hover:bg-sea-200"
                      >
                        ویرایش
                      </Link>
                      <form action={deleteProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                          حذف
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
