import Link from "next/link";
import Image from "next/image";
import { getSessionUser } from "@/lib/auth";
import { tierOf } from "@/lib/club";
import { getClubTiers, getClubConfig } from "@/lib/club-data";
import { faNum } from "@/lib/format";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";
export const metadata = { title: "باشگاه موآی" };

export default async function ClubPage() {
  const [user, TIERS, cfg] = await Promise.all([
    getSessionUser(),
    getClubTiers(),
    getClubConfig(),
  ]);
  const tier = user ? tierOf(user.points, TIERS) : null;

  const EARN = [
    { icon: "🛍️", title: "خرید", desc: `هر ۱۰۰ هزار تومان خرید، ${faNum(cfg.pointsPer100k)} امتیاز` },
    { icon: "🐚", title: "عضویت", desc: `همان اول ${faNum(cfg.welcomePoints)} امتیاز هدیه می‌گیری` },
    { icon: "🎟️", title: "کد اختصاصی", desc: "گاهی برای اعضای باشگاه کد تخفیف شخصی می‌فرستیم" },
    { icon: "🏷️", title: "حراج‌ها", desc: "اعضای باشگاه زودتر از همه از کمپین‌ها باخبر می‌شوند" },
  ];

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden bg-sea-900 pb-24 pt-40 text-sand-50">
        <Image src="/images/sunset.jpg" alt="" fill sizes="100vw" className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900 via-sea-900/40 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center md:px-8">
          <div className="eyebrow !text-clay-300">صدف، مرجان، مروارید…</div>
          <h1 className="font-display text-5xl font-black md:text-7xl">باشگاه موآی</h1>
          <p className="mx-auto mt-6 max-w-xl leading-9 text-sand-100/85">
            هر خرید از موآی فقط یک خرید نیست؛ قدمی‌ست به سمت دریا. امتیاز جمع کن،
            سطح بگیر و از تخفیف همیشگی، ارسال رایگان و هدیه‌های غافلگیرکننده لذت
            ببر.
          </p>
          {user && tier ? (
            <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 backdrop-blur">
              <span className="text-2xl">{tier.emoji}</span>
              <span className="font-bold">سطح شما: {tier.nameFa}</span>
              <span className="text-sand-100/70">· {faNum(user.points)} امتیاز</span>
            </div>
          ) : (
            <Link href="/login?next=/club" className="btn btn-primary mt-8 text-base">
              عضویت رایگان — همین حالا
            </Link>
          )}
        </div>
      </section>

      {/* tiers */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <Reveal key={t.key} delay={i * 0.1}>
              <div className={`h-full rounded-3xl bg-gradient-to-b ${t.color} p-8 ${tier?.key === t.key ? "ring-2 ring-clay-500 ring-offset-4 ring-offset-sand-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-5xl">{t.emoji}</span>
                  {tier?.key === t.key && (
                    <span className="chip bg-clay-500 text-sand-50">سطح فعلی شما</span>
                  )}
                </div>
                <h2 className="mt-5 font-display text-4xl font-black text-sea-900">{t.nameFa}</h2>
                <div className="mt-1 text-sm font-semibold text-ink/68">
                  {t.min === 0 ? "با اولین عضویت" : `از ${faNum(t.min)} امتیاز`}
                </div>
                <ul className="mt-6 space-y-3 text-sm leading-7 text-ink/88">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span className="mt-0.5 text-clay-500">✦</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* how to earn */}
      <section className="bg-sand-100 py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <Reveal className="text-center">
            <div className="eyebrow">امتیاز از کجا می‌آید؟</div>
            <h2 className="font-display text-4xl font-bold text-sea-900 md:text-5xl">
              جمع‌کردن امتیاز، ساده است
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {EARN.map((e, i) => (
              <Reveal key={e.title} delay={i * 0.08}>
                <div className="card h-full p-7 text-center">
                  <div className="text-4xl">{e.icon}</div>
                  <h3 className="mt-4 font-bold text-sea-900">{e.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-ink/75">{e.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          {!user && (
            <Reveal className="mt-12 text-center">
              <Link href="/login?next=/club" className="btn btn-primary text-base">
                شروع کن — عضویت رایگان است
              </Link>
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
