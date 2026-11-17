import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import Marquee from "@/components/Marquee";
import { getSettings, num } from "@/lib/settings";
import { faNum } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "قصه موآی" };

const VALUES = [
  {
    title: "دست‌دوز، نه خط تولید",
    desc: "هر محصول موآی در کارگاه خودمان و با دست دوخته می‌شود؛ برای همین هیچ دو محصولی دقیقاً مثل هم نیستند — و این را دوست داریم.",
  },
  {
    title: "پنبه، فقط پنبه",
    desc: "الیاف طبیعی نخ پنبه؛ لطیف روی پوست، جاذب و ماندگار. چیزی که بعد از ده‌ها بار شست‌وشو هنوز حالِ خوب می‌دهد.",
  },
  {
    title: "از اولین‌ها",
    desc: "بعضی از طرح‌های ما — مثل تن‌پوشِ پانچو که هم حوله است و هم رومایویی — جزو اولین‌ها در ایران هستند.",
  },
  {
    title: "استایل ساحلی، هر روز",
    desc: "محصولات ما فقط برای سفر نیستند؛ برای هر روزی‌اند که دلت می‌خواهد کمی دریا در خانه‌ات باشد.",
  },
];

export default async function AboutPage() {
  const s = await getSettings();
  const stats = [
    { value: num(s, "statFollowers"), label: "دنبال‌کننده" },
    { value: num(s, "statProducts"), label: "طرح و محصول" },
    { value: num(s, "statCustomers"), label: "مشتری راضی" },
    { value: num(s, "statYears"), label: "سال تجربه" },
  ].filter((x) => x.value > 0);

  return (
    <>
      <section className="relative overflow-hidden bg-sea-900 pb-28 pt-44 text-sand-50">
        <Image src="/images/shore.jpg" alt="" fill sizes="100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900 via-sea-900/30 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center md:px-8">
          <div className="eyebrow !text-clay-300">از یک عشق قدیمی به دریا…</div>
          <h1 className="font-display text-5xl font-black leading-[1.1] md:text-7xl">
            قصه موآی
          </h1>
        </div>
      </section>

      {/* stat counters - editable in admin → تنظیمات → آمار برند */}
      {stats.length > 0 && (
        <section className="border-b border-sand-200 bg-sand-100">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-12 md:grid-cols-4 md:px-8">
            {stats.map((st) => (
              <Reveal key={st.label} className="text-center">
                <div className="font-display text-4xl font-black text-clay-600 md:text-5xl">
                  {faNum(st.value)}
                  {st.value >= 1000 ? "+" : ""}
                </div>
                <div className="mt-1 text-sm font-semibold text-ink/70">{st.label}</div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 md:px-8 lg:grid-cols-2">
        <Reveal>
          <div className="space-y-6 whitespace-pre-line text-base leading-9 text-ink/88">
            <p>{s.aboutIntro}</p>
            <p>{s.aboutStory}</p>
          </div>
        </Reveal>
        <div className="relative mx-auto w-full max-w-md">
          <Reveal>
            <div className="img-frame -rotate-2">
              <Image src="/images/boho.jpg" alt="سبک زندگی موآی" width={620} height={760} className="aspect-[4/5] w-full object-cover" />
            </div>
          </Reveal>
          <Reveal delay={0.15} className="absolute -bottom-8 left-0 w-40 md:-left-4 md:w-52">
            <div className="rotate-6 rounded-2xl bg-sand-50 p-2 shadow-xl">
              <Image src="/images/aerial.jpg" alt="دریا از بالا" width={260} height={320} className="aspect-[4/5] w-full rounded-xl object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="border-y border-sand-200 bg-sand-100 py-4">
        <Marquee
          slow
          items={["دست‌دوز تهران", "پنبه طبیعی", "طرح‌های خاص", "از اولین‌ها در ایران", "ارسال به سراسر کشور"]}
          className="font-display text-xl text-sea-800/70"
        />
      </div>

      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={(i % 2) * 0.1}>
              <div className="card h-full p-8">
                <span className="font-display text-5xl font-black text-sand-300">
                  {(i + 1).toLocaleString("fa-IR").padStart(2, "۰")}
                </span>
                <h2 className="mt-4 font-display text-2xl font-bold text-sea-900">{v.title}</h2>
                <p className="mt-3 text-sm leading-8 text-ink/80">{v.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 text-center">
          <Link href="/products" className="btn btn-primary text-base">
            دیدن محصولات
          </Link>
        </Reveal>
      </section>
    </>
  );
}
