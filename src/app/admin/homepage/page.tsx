import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings, SETTING_DEFS } from "@/lib/settings";
import { HOME_SLOTS } from "@/lib/home";
import { toman, faNum } from "@/lib/format";
import {
  addHomeFeature, removeHomeFeature, moveHomeFeature, saveSettings,
} from "../actions";
import ProductPicker from "@/components/admin/ProductPicker";
import HeroTextForm from "@/components/admin/HeroTextForm";
import HeroImageForm from "@/components/admin/HeroImageForm";
import { getHeroContent } from "@/lib/hero";

export const dynamic = "force-dynamic";

const FIELDS = [
  { suffix: "Eyebrow", label: "تیتر کوچک (بالای عنوان)" },
  { suffix: "Title", label: "عنوان" },
  { suffix: "Sub", label: "توضیح زیر عنوان" },
] as const;

/** The order the sections actually appear in on the home page. */
const PAGE_ORDER = [
  "تصویر بالای صفحه",
  "نوار متحرک",
  "ویترین (کلکسیون تابستان)",
  "سه بنر (کلکسیون ساحلی / پانچو / کوچولوها)",
  "نسخه محدود",
  "محبوب‌ترین",
  "قصه موآی",
  "باشگاه موآی",
];

export default async function AdminHomepage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const [features, products, settings] = await Promise.all([
    db.homeFeature.findMany({
      orderBy: { sort: "asc" },
      include: { product: { include: { category: true } } },
    }),
    db.product.findMany({ include: { category: true }, orderBy: { nameFa: "asc" } }),
    getSettings(),
  ]);

  const pickerList = products.map((p) => ({
    id: p.id,
    nameFa: p.nameFa,
    categoryName: p.category.nameFa,
  }));

  const isTextarea = (key: string) =>
    SETTING_DEFS.find((d) => d.key === key && "type" in d && d.type === "textarea");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">صفحه اصلی</h1>
        <p className="mt-1 text-sm text-ink/68">
          انتخاب محصولات هر بخش و نوشتن عنوان‌ها — بدون نیاز به برنامه‌نویس.
        </p>
      </div>

      {saved && (
        <p className="rounded-2xl bg-sea-100 px-5 py-3 text-sm font-bold text-sea-700">
          ✓ ذخیره شد.
        </p>
      )}

      <HeroTextForm initial={getHeroContent(settings)} />
      <HeroImageForm initial={getHeroContent(settings)} />

      {/* what the page looks like now, top to bottom */}
      <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-100/60 p-5">
        <b className="text-sm text-sea-900">ترتیب بخش‌ها روی صفحه اصلی، از بالا به پایین:</b>
        <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-ink/75">
          {PAGE_ORDER.map((name, i) => (
            <li key={name} className="flex items-center gap-2">
              <span className="rounded-full bg-sand-50 px-3 py-1.5 font-semibold text-sea-900">
                {faNum(i + 1)}. {name}
              </span>
              {i < PAGE_ORDER.length - 1 && <span className="text-sand-400">←</span>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-6 text-ink/60">
          سه بنر میانی از{" "}
          <Link href="/admin/banners" className="font-semibold text-clay-600 hover:underline">
            بنرها
          </Link>{" "}
          خوانده می‌شوند و «قصه موآی» و «باشگاه» از بخش‌های خودشان.
        </p>
      </div>

      {HOME_SLOTS.map((slot) => {
        const chosen = features.filter((f) => f.slot === slot.slot);
        const isLimited = slot.slot === "SPECIAL";
        return (
          <section key={slot.slot} className="card p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-sea-900">{slot.nameFa}</h2>
              <span className="chip bg-sand-100 text-ink/68">{faNum(chosen.length)} محصول</span>
            </div>

            <p className="mt-2 max-w-3xl text-xs leading-6 text-ink/68">{slot.note}</p>

            {slot.slot === "SHOWCASE" && chosen.length === 0 && (
              <p className="mt-3 rounded-xl bg-gold/12 px-4 py-2.5 text-xs leading-6 text-clay-700">
                تا وقتی این فهرست خالی است، ویترین همان محصولاتی را نشان می‌دهد که
                در «محصولات» تیکِ «نمایش در ویترین صفحه اصلی» خورده‌اند.
              </p>
            )}
            {slot.slot !== "SHOWCASE" && chosen.length === 0 && (
              <p className="mt-3 rounded-xl bg-sand-100 px-4 py-2.5 text-xs leading-6 text-ink/68">
                این بخش تا وقتی خالی است، اصلاً روی صفحه اصلی نشان داده نمی‌شود.
              </p>
            )}

            {/* ── the chosen list ── */}
            {chosen.length > 0 && (
              <ul className="mt-5 space-y-2">
                {chosen.map((f, i) => {
                  // نسخه محدود shows only its first product big on the page
                  const isHero = isLimited && i === 0;
                  return (
                    <li
                      key={f.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3 ${
                        isHero ? "border-clay-400 bg-clay-500/6" : "border-sand-200"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-center text-sm font-bold text-ink/50">
                        {faNum(i + 1)}
                      </span>
                      <Image
                        src={f.product.image}
                        alt=""
                        width={40}
                        height={48}
                        className="h-12 w-10 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/products/${f.product.id}`}
                          className="block truncate text-sm font-semibold text-sea-900 hover:text-clay-600"
                        >
                          {f.product.nameFa}
                        </Link>
                        <div className="text-xs text-ink/60">
                          {f.product.category.nameFa} · {toman(f.product.salePrice ?? f.product.price)}
                          {!f.product.active && (
                            <b className="mr-2 text-clay-600">— مخفی از فروشگاه</b>
                          )}
                        </div>
                      </div>
                      {isLimited && (
                        <span
                          className={`chip shrink-0 ${
                            isHero ? "bg-clay-500 text-sand-50" : "bg-sand-100 text-ink/60"
                          }`}
                        >
                          {isHero ? "★ عکس بزرگ صفحه اصلی" : "در فهرست «همه»"}
                        </span>
                      )}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <MoveButton id={f.id} dir="up" disabled={i === 0} />
                        <MoveButton id={f.id} dir="down" disabled={i === chosen.length - 1} />
                        <form action={removeHomeFeature}>
                          <input type="hidden" name="id" value={f.id} />
                          <button
                            title="حذف از این بخش"
                            className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-sm font-bold text-red-600 hover:bg-red-100"
                          >
                            ✕
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {isLimited && chosen.length > 0 && (
              <p className="mt-3 text-xs leading-6 text-ink/68">
                برای عوض کردن عکس بزرگ، محصول دلخواه را با ↑ به ردیف اول بیاور.{" "}
                <Link
                  href="/products?limited=1"
                  target="_blank"
                  className="font-semibold text-clay-600 hover:underline"
                >
                  دیدن صفحه‌ی «همه‌ی نسخه‌های محدود»
                </Link>
              </p>
            )}

            {/* ── add ── */}
            <div className="mt-5">
              <ProductPicker
                products={pickerList}
                chosenIds={chosen.map((f) => f.productId)}
                slot={slot.slot}
                action={addHomeFeature}
              />
            </div>

            {/* ── titles ── */}
            <form action={saveSettings} className="mt-6 border-t border-sand-200 pt-5">
              <input type="hidden" name="redirectTo" value="/admin/homepage?saved=1" />
              <div className="grid gap-4 md:grid-cols-3">
                {FIELDS.map((f) => {
                  const key = `${slot.prefix}${f.suffix}`;
                  return (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-semibold text-ink/68">
                        {f.label}
                      </label>
                      {isTextarea(key) ? (
                        <textarea
                          name={`s_${key}`}
                          defaultValue={settings[key]}
                          className="input min-h-24 resize-y text-sm"
                        />
                      ) : (
                        <input
                          name={`s_${key}`}
                          defaultValue={settings[key]}
                          className="input text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-dark mt-4 !px-6 !py-2.5 text-sm">ذخیره عنوان‌ها</button>
            </form>
          </section>
        );
      })}
    </div>
  );
}

function MoveButton({ id, dir, disabled }: { id: string; dir: "up" | "down"; disabled: boolean }) {
  return (
    <form action={moveHomeFeature}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <button
        disabled={disabled}
        title={dir === "up" ? "بالاتر" : "پایین‌تر"}
        className="grid h-9 w-9 place-items-center rounded-xl bg-sand-100 text-sm font-bold text-sea-800 hover:bg-sand-200 disabled:opacity-35"
      >
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
