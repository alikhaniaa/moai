import { db } from "@/lib/db";
import { faNum } from "@/lib/format";
import { saveCategory, deleteCategory } from "../actions";
import ImagePicker from "@/components/admin/ImagePicker";

export const dynamic = "force-dynamic";

/**
 * Categories are two levels deep and drive both the shop filter and the
 * homepage tiles, so renaming a group, reordering it or swapping its photo has
 * to be doable here rather than in the database.
 */
export default async function AdminCategories({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { error } = (await searchParams) ?? {};
  const cats = await db.category.findMany({
    orderBy: { sort: "asc" },
    include: { _count: { select: { products: true, children: true } } },
  });

  const parents = cats.filter((c) => !c.parentId);
  const byId = new Map(cats.map((c) => [c.id, c]));

  // parents first, each followed by its own children
  const ordered = parents.flatMap((p) => [
    p,
    ...cats.filter((c) => c.parentId === p.id),
  ]);
  const orphans = cats.filter((c) => c.parentId && !byId.has(c.parentId));

  return (
    <div className="space-y-8">
      {error === "duplicate" && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          دسته‌بندی دیگری با همین اسلاگ وجود دارد؛ چیزی ذخیره نشد. اسلاگ باید یکتا باشد.
        </p>
      )}
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">دسته‌بندی‌ها</h1>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-ink/68">
          گروه‌های اصلی و زیرگروه‌هایشان. محصول همیشه به یک زیرگروه وصل می‌شود و
          صفحه‌ی گروه اصلی، همه‌ی محصولات زیرگروه‌هایش را نشان می‌دهد. کاشی‌های
          صفحه اصلی هم از گروه‌های اصلی (به ترتیب همین «ترتیب») ساخته می‌شوند —
          اولین گروه، کاشی بزرگ است.
        </p>
      </div>

      <div className="space-y-4">
        {[...ordered, ...orphans].map((c) => (
          <form
            key={c.id}
            action={saveCategory}
            className={`card grid items-end gap-4 p-5 md:grid-cols-12 ${
              c.parentId ? "mr-6 border-r-4 border-r-sand-300" : ""
            }`}
          >
            <input type="hidden" name="id" value={c.id} />

            <Field label="نام" className="md:col-span-3">
              <input name="nameFa" defaultValue={c.nameFa} className="input text-sm" />
            </Field>
            <Field label="اسلاگ (در نشانی)" className="md:col-span-2">
              <input name="slug" defaultValue={c.slug} dir="ltr" className="input text-sm" />
            </Field>
            <Field label="زیرمجموعه‌ی" className="md:col-span-3">
              <select name="parentId" defaultValue={c.parentId ?? ""} className="input text-sm">
                <option value="">— گروه اصلی —</option>
                {parents
                  .filter((p) => p.id !== c.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.nameFa}</option>
                  ))}
              </select>
            </Field>
            <Field label="ترتیب" className="md:col-span-1">
              <input name="sort" type="number" dir="ltr" defaultValue={c.sort} className="input text-sm" />
            </Field>

            <div className="flex items-center gap-3 pb-2.5 md:col-span-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-sea-900">
                <input
                  type="checkbox" name="active" defaultChecked={c.active}
                  className="h-5 w-5 accent-clay-500"
                />
                فعال
              </label>
              <button className="btn btn-dark !px-5 !py-2 text-sm">ذخیره</button>
            </div>

            <div className="md:col-span-8">
              <ImagePicker name="image" defaultValue={c.image ?? ""} label="عکس کاشی (اختیاری)" />
              <p className="mt-1.5 text-xs text-ink/60">
                اگر عکسی نگذاری، از عکس یکی از محصولات همین گروه استفاده می‌شود.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 md:col-span-4">
              <span className="text-xs text-ink/60">
                {faNum(c._count.products)} محصول
                {c._count.children > 0 && ` · ${faNum(c._count.children)} زیرگروه`}
              </span>
            </div>
          </form>
        ))}
      </div>

      {/* delete is its own form so it can't be submitted by the ذخیره button */}
      <div className="card p-6">
        <h2 className="mb-4 font-bold text-sea-900">حذف دسته‌بندی</h2>
        <p className="mb-4 text-sm leading-7 text-ink/68">
          دسته‌ای که محصول یا زیرگروه دارد حذف نمی‌شود — فقط غیرفعال می‌شود تا
          محصولاتش بی‌صاحب نمانند.
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <form key={c.id} action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                {c.nameFa} ✕
              </button>
            </form>
          ))}
        </div>
      </div>

      {/* new */}
      <div className="card p-6">
        <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">دسته‌بندی جدید</h2>
        <form action={saveCategory} className="grid items-end gap-4 md:grid-cols-12">
          <Field label="نام" className="md:col-span-3">
            <input name="nameFa" required className="input text-sm" />
          </Field>
          <Field label="اسلاگ (انگلیسی)" className="md:col-span-3">
            <input name="slug" required dir="ltr" className="input text-sm" placeholder="new-group" />
          </Field>
          <Field label="زیرمجموعه‌ی" className="md:col-span-3">
            <select name="parentId" className="input text-sm" defaultValue="">
              <option value="">— گروه اصلی —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.nameFa}</option>
              ))}
            </select>
          </Field>
          <Field label="ترتیب" className="md:col-span-1">
            <input name="sort" type="number" dir="ltr" defaultValue={99} className="input text-sm" />
          </Field>
          <div className="flex items-center gap-3 pb-2.5 md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-sea-900">
              <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-clay-500" />
              فعال
            </label>
            <button className="btn btn-primary !px-5 !py-2 text-sm">ساختن</button>
          </div>
        </form>
      </div>
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
