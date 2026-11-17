import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import type { BannerData } from "@/lib/banners";

/**
 * Promo banners, fully driven by the admin panel. Renders nothing when the shop
 * has no active banners, so the homepage never shows an empty slot.
 */
export default function BannerStrip({ banners }: { banners: BannerData[] }) {
  const items = banners.filter((b) => b.slot !== "HERO");
  if (items.length === 0) return null;

  const [lead, ...rest] = items;

  const Card = ({ b, tall }: { b: BannerData; tall?: boolean }) => {
    const inner = (
      <div
        className={`img-frame group relative isolate flex items-end overflow-hidden ${
          tall ? "min-h-80 md:min-h-[30rem]" : "min-h-56"
        }`}
      >
        <Image
          src={b.image}
          alt={b.title}
          fill
          sizes={tall ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 1024px) 100vw, 25vw"}
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900/85 via-sea-900/25 to-transparent" />
        <div className="relative z-10 p-6 md:p-8">
          {b.badge && (
            <span className="chip mb-3 bg-clay-500 text-sand-50">{b.badge}</span>
          )}
          <h3 className={`font-display font-black text-sand-50 ${tall ? "text-3xl md:text-5xl" : "text-2xl"}`}>
            {b.title}
          </h3>
          {b.subtitle && (
            <p className="mt-2 max-w-sm text-sm leading-7 text-sand-100/85">{b.subtitle}</p>
          )}
          {b.link && (
            <span className="mt-4 inline-block text-sm font-bold text-clay-300 underline underline-offset-8">
              مشاهده ←
            </span>
          )}
        </div>
      </div>
    );
    return b.link ? <Link href={b.link}>{inner}</Link> : inner;
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-8">
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <Card b={lead} tall />
        </Reveal>
        {rest.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {rest.slice(0, 2).map((b, i) => (
              <Reveal key={b.id} delay={0.08 * (i + 1)}>
                <Card b={b} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
