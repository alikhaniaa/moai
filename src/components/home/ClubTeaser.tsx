import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import { TIERS as DEFAULT_TIERS, type Tier } from "@/lib/club";
import { faNum } from "@/lib/format";

/** `tiers` comes from the DB via the page, so admin edits show up here too. */
export default function ClubTeaser({ tiers }: { tiers?: Tier[] }) {
  const TIERS = tiers && tiers.length > 0 ? tiers : DEFAULT_TIERS;
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <Image
        src="/images/sunset.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-sea-900/80" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <div className="eyebrow !text-clay-300">با هر خرید، به دریا نزدیک‌تر…</div>
            <h2 className="font-display text-4xl font-bold leading-[1.15] text-sand-50 md:text-6xl">
              باشگاه موآی
            </h2>
            <p className="mt-5 text-base leading-9 text-sand-100/80">
              عضویت رایگان است؛ با هر خرید امتیاز جمع می‌کنی و از صدف تا مروارید
              بالا می‌روی — تخفیف همیشگی، ارسال رایگان و هدیه‌های غافلگیرکننده.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <Reveal key={t.key} delay={i * 0.12}>
              <div className="h-full rounded-3xl border border-white/15 bg-white/8 p-7 backdrop-blur-md transition-colors duration-300 hover:border-clay-300/60 hover:bg-white/12">
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{t.emoji}</span>
                  <span className="chip border border-white/20 text-sand-100/80">
                    {t.min === 0 ? "شروع" : `${faNum(t.min)}+ امتیاز`}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-3xl font-bold text-sand-50">{t.nameFa}</h3>
                <ul className="mt-4 space-y-2.5 text-sm leading-7 text-sand-100/80">
                  {t.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <span className="mt-0.5 text-clay-300">✦</span>
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 text-center" delay={0.2}>
          <Link href="/club" className="btn btn-primary text-base">
            عضویت رایگان در باشگاه
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
