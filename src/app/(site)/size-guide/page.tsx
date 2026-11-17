import Link from "next/link";
import { getSizeCharts } from "@/lib/sizes";
import { getSettings } from "@/lib/settings";
import SizeEstimator from "@/components/SizeEstimator";
import SectionHeading from "@/components/SectionHeading";
import Reveal from "@/components/Reveal";
import type { SizeOption } from "@/lib/sizing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "راهنمای سایز",
  description:
    "سایز پانچو، تن‌پوش، حوله و زیرانداز موآی چطور انتخاب می‌شود — جدول سایزها، روش اندازه‌گیری و تخمین‌گر سایز.",
};

type ChartRow = {
  id: string; label: string; rangeLabel: string; extraLabel: string; kind: string;
  fitFrom: number | null; fitTo: number | null;
  heightFrom: number | null; heightTo: number | null; lengthCm: number | null;
};

const toOptions = (rows: ChartRow[]): SizeOption[] =>
  rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    fitFrom: r.fitFrom,
    fitTo: r.fitTo,
    heightFrom: r.heightFrom,
    heightTo: r.heightTo,
    lengthCm: r.lengthCm,
  }));

export default async function SizeGuidePage() {
  const [charts, s] = await Promise.all([getSizeCharts(), getSettings()]);

  // the estimator answers for adults from the wearable table and for children
  // from the kids one - both come from جدول سایزها, never from code
  const wearable = charts.find((c) => c.key === "wearable");
  const kids = charts.find((c) => c.key === "kids");

  return (
    <>
      <section className="relative overflow-hidden bg-sea-900 pb-20 pt-36 text-sand-50">
        <div className="mx-auto max-w-4xl px-6 md:px-8">
          <div className="eyebrow !text-clay-300">تا مطمئن سفارش بدهی…</div>
          <h1 className="font-display text-5xl font-black md:text-7xl">راهنمای سایز</h1>
          <p className="mt-5 max-w-2xl leading-9 text-sand-200/85">
            محصولات موآی گشاد و راحت دوخته می‌شوند، اما «راحت» برای هر بدنی یک
            اندازه نیست. این صفحه دو کار می‌کند: می‌گوید سایزهای ایرانی چطور کار
            می‌کنند، و با چند عدد ساده حدس می‌زند کدام سایز به تو می‌خورد.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 md:px-8 md:py-24">
        {/* ── the estimator, embedded ── */}
        {(wearable || kids) && (
          <Reveal>
            <div className="card p-6 md:p-8">
              <SectionHeading
                eyebrow="اندازه‌ات را حدس می‌زنیم…"
                title="سایزم را پیدا کن"
                sub="قد و وزنت کافی است. هرچه اطلاعات بیشتری بدهی، حدس دقیق‌تر می‌شود."
              />
              <div className="mt-8">
                <SizeEstimator
                  sizes={toOptions((wearable?.rows ?? []) as ChartRow[])}
                  kidSizes={toOptions((kids?.rows ?? []) as ChartRow[])}
                  whatsapp={s.shopWhatsapp}
                />
              </div>
            </div>
          </Reveal>
        )}

        {/* ── how Iranian sizes work ── */}
        <Reveal>
          <h2 className="mt-20 font-display text-3xl font-bold text-sea-900 md:text-4xl">
            سایزهای ایرانی چطور کار می‌کنند؟
          </h2>
          <div className="mt-4 space-y-4 leading-9 text-ink/82">
            <p>
              سایز آماده‌ی ایرانی از ۳۶ شروع می‌شود و تا ۵۶ می‌رود، و هر سایز
              حدود ۴ سانتی‌متر به دور باسن اضافه می‌کند — سایز ۳۶ یعنی دور باسن
              حدود ۸۸ سانتی‌متر، سایز ۳۸ حدود ۹۲، و همین‌طور بالا.
            </p>
            <p>
              برای همین اگر دور باسنت را بدانی، سایزت را تقریباً دقیق می‌دانی؛ و
              اگر ندانی، از قد و وزن هم می‌شود حدس نسبتاً خوبی زد. هر دو راه در
              همین صفحه هست.
            </p>
          </div>
        </Reveal>

        {/* ── how to measure ── */}
        <Reveal>
          <h2 className="mt-16 font-display text-3xl font-bold text-sea-900 md:text-4xl">
            چطور خودت را اندازه بگیری
          </h2>
          <ol className="mt-5 space-y-4">
            {[
              {
                t: "دور سینه",
                d: "متر را دور پرترین قسمت سینه بگیر، موازی با زمین. نه شل، نه سفت — طوری که یک انگشت زیر متر جا شود.",
              },
              {
                t: "دور باسن",
                d: "پرترین قسمت باسن را اندازه بگیر، در حالی که پاها کنار هم است. همین عدد است که سایز ایرانی را تعیین می‌کند.",
              },
              {
                t: "قد",
                d: "بدون کفش، پشت به دیوار بایست و از فرق سر تا کف زمین را اندازه بگیر. قد تعیین می‌کند لبه‌ی پانچو یا تن‌پوش کجای پایت بیفتد.",
              },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-4 rounded-2xl bg-sand-100 p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay-500 font-bold text-sand-50">
                  {(i + 1).toLocaleString("fa-IR")}
                </span>
                <div>
                  <b className="text-sea-900">{step.t}</b>
                  <p className="mt-1 text-sm leading-8 text-ink/82">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* ── why loose, and what فری‌سایز covers ── */}
        <Reveal>
          <h2 className="mt-16 font-display text-3xl font-bold text-sea-900 md:text-4xl">
            چرا این‌ها گشاد دوخته می‌شوند؟
          </h2>
          <div className="mt-4 space-y-4 leading-9 text-ink/82">
            <p>
              پانچو، تن‌پوش و رومایویی لباس بیرون نیستند؛ روی بدن خیس و روی
              مایو پوشیده می‌شوند و باید راحت در بیایند و راحت خشک کنند. برای
              همین عمداً یک تا دو سایز آزادتر از لباس معمولی دوخته می‌شوند.
            </p>
            <p>
              «فری‌سایز» یعنی یک برش که بازه‌ی وسیعی از بدن‌ها را می‌پوشاند — نه
              یعنی «به همه می‌خورد». بازه‌ی دقیقش در جدول زیر نوشته شده؛ اگر
              سایزت از آن بالاتر است، سایز سفارشی جواب توست، نه فری‌سایز.
            </p>
          </div>
        </Reveal>

        {/* ── the tables, straight from جدول سایزها ── */}
        {charts.map((c) => (
          <Reveal key={c.id}>
            <h2 className="mt-16 font-display text-3xl font-bold text-sea-900 md:text-4xl">
              {c.nameFa}
            </h2>
            {c.intro && <p className="mt-3 leading-9 text-ink/82">{c.intro}</p>}
            <div className="card mt-5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sand-100 text-xs text-ink/68">
                    <tr>
                      <th className="px-5 py-3 text-right font-semibold">سایز</th>
                      {c.col2Label && (
                        <th className="px-5 py-3 text-right font-semibold">{c.col2Label}</th>
                      )}
                      {c.col3Label && (
                        <th className="px-5 py-3 text-right font-semibold">{c.col3Label}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr key={r.id} className="border-t border-sand-100">
                        <td className="px-5 py-3 font-bold text-sea-900">{r.label}</td>
                        {c.col2Label && <td className="px-5 py-3 text-ink/82">{r.rangeLabel || "—"}</td>}
                        {c.col3Label && <td className="px-5 py-3 text-ink/82">{r.extraLabel || "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        ))}

        {/* ── سایز سفارشی ── */}
        <Reveal>
          <div className="mt-16 rounded-3xl border border-dashed border-sea-300 bg-sea-100/50 p-6 md:p-8">
            <h2 className="font-display text-3xl font-bold text-sea-900">سایز سفارشی</h2>
            <div className="mt-4 space-y-4 leading-9 text-ink/82">
              <p>
                اگر سایزت بالاتر از جدول است، قد بلندتری می‌خواهی، یا ابعاد
                بزرگ‌تری از زیرانداز لازم داری، همان مدل را اندازه‌ی خودت
                می‌دوزیم. سایز سفارشی آنلاین ثبت نمی‌شود چون قیمت و زمان
                آماده‌سازی‌اش به اندازه‌ها بستگی دارد.
              </p>
              <p>
                کافی است در واتس‌اپ بگویی کدام محصول، چه قدی و چه اندازه‌هایی —
                همان‌جا قیمت و زمان تحویل را می‌گوییم.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${s.shopWhatsapp}?text=${encodeURIComponent("سلام! برای سفارش سایز سفارشی راهنمایی می‌خواستم.")}`}
                target="_blank"
                rel="noopener"
                className="btn btn-primary"
              >
                گفتگو در واتس‌اپ
              </a>
              <Link href="/products" className="btn btn-ghost">
                دیدن فروشگاه
              </Link>
            </div>
          </div>
        </Reveal>

        <p className="mt-10 text-center text-sm leading-8 text-ink/68">
          هنوز مطمئن نیستی؟ عکسِ متر روی خودت را در واتس‌اپ بفرست — با هم انتخاب
          می‌کنیم. تخمین این صفحه ±۱ سایز خطا دارد.
        </p>
      </section>
    </>
  );
}
