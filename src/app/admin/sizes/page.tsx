import Link from "next/link";
import { db } from "@/lib/db";
import { faNum } from "@/lib/format";
import { saveSizeChart, saveSizeChartRows, deleteSizeChart } from "../actions";
import SizeChartRepeater, { type ChartRowData } from "@/components/admin/SizeChartRepeater";

export const dynamic = "force-dynamic";

export default async function AdminSizes({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const charts = await db.sizeChart.findMany({
    orderBy: { sort: "asc" },
    include: { rows: { orderBy: { sort: "asc" } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">جدول سایزها</h1>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-ink/68">
          الگوهای سایزبندی فروشگاه. صفحه‌ی{" "}
          <Link href="/size-guide" className="font-semibold text-clay-600 hover:underline">
            راهنمای سایز
          </Link>{" "}
          و تخمین‌گر سایز هر دو از همین‌جا می‌خوانند، و در فرم محصول با دکمه‌ی
          «الگوی سایزبندی» یک‌جا داخل محصول ریخته می‌شوند.
        </p>
      </div>

      {saved && (
        <p className="rounded-2xl bg-sea-100 px-5 py-3 text-sm font-bold text-sea-700">✓ ذخیره شد.</p>
      )}

      <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-100/60 p-5 text-sm leading-7 text-ink/75">
        <b className="text-sea-900">ستون‌های عددی چه کاری می‌کنند؟</b> «سایز از/تا»
        همان عددهای سایز ایرانی‌اند (۳۶ تا ۵۶) و تخمین‌گر با آن‌ها تصمیم می‌گیرد.
        «قد از/تا» برای سایزهای بچگانه است. «طول لباس» باعث می‌شود به مشتری بگوییم
        لبه‌ی لباس کجای پایش می‌افتد. ستون‌های متنی فقط برای خواندن مشتری‌اند.
      </div>

      {charts.map((c) => (
        <section key={c.id} className="card p-6 md:p-8">
          <form action={saveSizeChart} className="grid items-end gap-4 md:grid-cols-6">
            <input type="hidden" name="id" value={c.id} />
            <Field label="نام جدول" className="md:col-span-2">
              <input name="nameFa" defaultValue={c.nameFa} className="input text-sm" />
            </Field>
            <Field label="کلید (انگلیسی)">
              <input name="key" defaultValue={c.key} dir="ltr" className="input text-sm" />
            </Field>
            <Field label="عنوان ستون دوم">
              <input name="col2Label" defaultValue={c.col2Label} className="input text-sm" />
            </Field>
            <Field label="عنوان ستون سوم">
              <input name="col3Label" defaultValue={c.col3Label} className="input text-sm" />
            </Field>
            <Field label="ترتیب">
              <input name="sort" type="number" dir="ltr" defaultValue={c.sort} className="input text-sm" />
            </Field>
            <Field label="توضیح زیر عنوان (اختیاری)" className="md:col-span-5">
              <input name="intro" defaultValue={c.intro} className="input text-sm" />
            </Field>
            <div className="flex items-center gap-3 pb-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-sea-900">
                <input
                  type="checkbox" name="active" defaultChecked={c.active}
                  className="h-5 w-5 accent-clay-500"
                />
                فعال
              </label>
              <button className="btn btn-dark !px-5 !py-2 text-sm">ذخیره</button>
            </div>
          </form>

          <div className="mt-6 border-t border-sand-200 pt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-sea-900">
                ردیف‌ها <span className="text-xs font-normal text-ink/60">({faNum(c.rows.length)})</span>
              </h3>
            </div>

            <form action={saveSizeChartRows}>
              <input type="hidden" name="chartId" value={c.id} />
              <SizeChartRepeater
                name="rows"
                col2Label={c.col2Label}
                col3Label={c.col3Label}
                initial={c.rows.map(
                  (r): ChartRowData => ({
                    label: r.label,
                    rangeLabel: r.rangeLabel,
                    extraLabel: r.extraLabel,
                    kind: r.kind,
                    fitFrom: r.fitFrom ?? "",
                    fitTo: r.fitTo ?? "",
                    heightFrom: r.heightFrom ?? "",
                    heightTo: r.heightTo ?? "",
                    lengthCm: r.lengthCm ?? "",
                    active: r.active,
                  })
                )}
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="btn btn-primary !px-6 !py-2.5 text-sm">ذخیره ردیف‌ها</button>
              </div>
            </form>
          </div>

          <form action={deleteSizeChart} className="mt-6 border-t border-sand-100 pt-4">
            <input type="hidden" name="id" value={c.id} />
            <button className="text-xs font-semibold text-red-600 hover:underline">
              حذف کامل این جدول
            </button>
          </form>
        </section>
      ))}

      {/* new chart */}
      <section className="card p-6 md:p-8">
        <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">جدول جدید</h2>
        <form action={saveSizeChart} className="grid items-end gap-4 md:grid-cols-6">
          <Field label="نام جدول" className="md:col-span-2">
            <input name="nameFa" required className="input text-sm" placeholder="کیف و اکسسوری" />
          </Field>
          <Field label="کلید (انگلیسی)">
            <input name="key" required dir="ltr" className="input text-sm" placeholder="bags" />
          </Field>
          <Field label="عنوان ستون دوم">
            <input name="col2Label" className="input text-sm" placeholder="ابعاد" />
          </Field>
          <Field label="عنوان ستون سوم">
            <input name="col3Label" className="input text-sm" />
          </Field>
          <div className="flex items-center gap-3 pb-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-sea-900">
              <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-clay-500" />
              فعال
            </label>
            <button className="btn btn-primary !px-5 !py-2 text-sm">ساختن</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label, children, className,
}: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-ink/68">{label}</label>
      {children}
    </div>
  );
}
