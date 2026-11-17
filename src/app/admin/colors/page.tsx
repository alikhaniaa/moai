import Link from "next/link";
import { db } from "@/lib/db";
import { faNum } from "@/lib/format";
import { saveColorPreset, deleteColorPreset } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminColors({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const [presets, used] = await Promise.all([
    db.colorPreset.findMany({ orderBy: [{ sort: "asc" }, { nameFa: "asc" }] }),
    db.productColor.groupBy({ by: ["nameFa"], _count: { _all: true } }),
  ]);
  const usageByName = new Map(used.map((u) => [u.nameFa, u._count._all]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">جدول رنگ‌ها</h1>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-ink/68">
          پالت رنگ فروشگاه. در فرم هر محصول، با «از جدول رنگ‌ها» همین رنگ‌ها یک‌کلیکی
          داخل محصول ریخته می‌شوند. قیمت هر رنگ در خودِ محصول تعیین می‌شود، نه اینجا —
          چون ممکن است یک رنگ روی یک محصول گران‌تر باشد و روی محصول دیگر نه.
        </p>
      </div>

      {saved && (
        <p className="rounded-2xl bg-sea-100 px-5 py-3 text-sm font-bold text-sea-700">✓ ذخیره شد.</p>
      )}

      <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-100/60 p-5 text-sm leading-7 text-ink/75">
        <b className="text-sea-900">تغییر اینجا روی محصول‌های قبلی اثر ندارد.</b> هر محصول
        نسخه‌ی خودش از نام و رنگ را نگه می‌دارد، پس ویرایش یا حذف یک رنگ در این
        جدول هیچ قیمتی را در فروشگاه جابه‌جا نمی‌کند. برای عوض کردن رنگِ یک محصول،
        باید در{" "}
        <Link href="/admin/products" className="font-semibold text-clay-600 hover:underline">
          صفحه‌ی همان محصول
        </Link>{" "}
        تغییرش بدهی.
      </div>

      <section className="card p-6 md:p-8">
        <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">رنگ‌های ذخیره‌شده</h2>

        {presets.length === 0 ? (
          <p className="rounded-xl bg-sand-100 px-4 py-6 text-center text-sm text-ink/60">
            هنوز رنگی تعریف نکرده‌ای — از فرم پایین اولین رنگ را اضافه کن.
          </p>
        ) : (
          <ul className="space-y-3">
            {presets.map((c) => (
              <li key={c.id} className="rounded-2xl border border-sand-200 bg-white p-4">
                <form action={saveColorPreset} className="grid items-end gap-3 md:grid-cols-[auto_1.6fr_0.7fr_auto_auto]">
                  <input type="hidden" name="id" value={c.id} />
                  <Field label="رنگ">
                    <input
                      name="hex"
                      type="color"
                      defaultValue={c.hex}
                      aria-label={`رنگ ${c.nameFa}`}
                      className="h-11 w-14 cursor-pointer rounded-xl border border-sand-200 bg-white p-1"
                    />
                  </Field>
                  <Field label="نام رنگ">
                    <input name="nameFa" defaultValue={c.nameFa} className="input !py-2.5 text-sm" />
                  </Field>
                  <Field label="ترتیب">
                    <input name="sort" type="number" defaultValue={c.sort} dir="ltr" className="input !py-2.5 text-sm" />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-2 pb-3 text-sm font-semibold text-sea-900">
                    <input type="checkbox" name="active" defaultChecked={c.active} className="h-5 w-5 accent-clay-500" />
                    فعال
                  </label>
                  <div className="flex items-end gap-2 pb-1">
                    <button className="btn btn-dark !px-5 !py-2.5 text-sm">ذخیره</button>
                  </div>
                </form>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-sand-100 pt-3">
                  <span className="text-xs text-ink/60">
                    {usageByName.has(c.nameFa) ? (
                      <>
                        روی{" "}
                        <b className="text-sea-900">{faNum(usageByName.get(c.nameFa)!)}</b> محصول
                        استفاده شده — حذفش آن‌ها را تغییر نمی‌دهد.
                      </>
                    ) : (
                      "هنوز روی هیچ محصولی استفاده نشده."
                    )}
                  </span>
                  <form action={deleteColorPreset}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100">
                      حذف از پالت
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6 md:p-8">
        <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">افزودن رنگ تازه</h2>
        <form action={saveColorPreset} className="grid items-end gap-3 md:grid-cols-[auto_1.6fr_0.7fr_auto_auto]">
          <Field label="رنگ">
            <input
              name="hex"
              type="color"
              defaultValue="#4a8578"
              aria-label="رنگ تازه"
              className="h-11 w-14 cursor-pointer rounded-xl border border-sand-200 bg-white p-1"
            />
          </Field>
          <Field label="نام رنگ *">
            <input name="nameFa" required placeholder="آبی اقیانوسی" className="input !py-2.5 text-sm" />
          </Field>
          <Field label="ترتیب">
            <input name="sort" type="number" defaultValue={presets.length} dir="ltr" className="input !py-2.5 text-sm" />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 pb-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-clay-500" />
            فعال
          </label>
          <div className="flex items-end pb-1">
            <button className="btn btn-primary !px-5 !py-2.5 text-sm">افزودن</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-ink/68">{label}</label>
      {children}
    </div>
  );
}
