"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsoLayoutEffect } from "@/lib/useIsoLayoutEffect";
import { toman, faNum, discountPct } from "@/lib/format";
import type { ProductCardData } from "@/components/ProductCard";

gsap.registerPlugin(ScrollTrigger);

/**
 * Renders `*دریا*` as a coloured word, so the shop owner can keep the accent
 * in the showcase headline from تنظیمات without touching any markup.
 */
const highlight = (text: string) =>
  text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <span key={i} className="text-sea-300">
        {part.slice(1, -1)}
      </span>
    ) : (
      part
    )
  );

/**
 * Pinned horizontal "shoreline" gallery of featured products.
 * Desktop: section pins and scroll drives the track sideways.
 * Mobile: falls back to native swipe scrolling.
 */
export default function HorizontalShowcase({
  products,
  eyebrow,
  title,
  sub,
}: {
  products: ProductCardData[];
  eyebrow: string;
  /** Newlines are kept, and a *word* between stars is picked out in colour. */
  title: string;
  sub: string;
}) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // layout effect: revert must run BEFORE React deletes DOM nodes on route
  // change, otherwise the pin-spacer wrapper breaks unmounting (removeChild)
  useIsoLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      const el = track.current!;
      // RTL: hidden items overflow to the left → push track right while scrolling
      const distance = () => el.scrollWidth - window.innerWidth;
      gsap.to(el, {
        x: distance,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
      // no manual cleanup here: matchMedia's context revert must be the one
      // to tear this down, so the pin-spacer wrapper is fully removed from
      // the DOM before React unmounts the page (otherwise removeChild throws)
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="relative overflow-hidden bg-sea-800 text-sand-50">
      <div className="flex min-h-svh flex-col justify-center py-16 lg:py-0">
        {/* lg:will-change-transform: the pin scrubs this track's transform, so
            promote its layer before the first scroll frame - promoting it *during*
            that frame is the visible stutter on entry */}
        <div
          ref={track}
          className="flex items-stretch gap-6 overflow-x-auto px-6 [scrollbar-width:none] md:px-10 lg:w-max lg:overflow-visible lg:will-change-transform"
        >
          {/* intro card */}
          <div className="flex w-[82vw] shrink-0 flex-col justify-center md:w-[46vw] lg:w-[34vw]">
            <div className="eyebrow !text-clay-300">{eyebrow}</div>
            <h2 className="whitespace-pre-line font-display text-5xl font-black leading-[1.1] md:text-7xl">
              {highlight(title)}
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-8 text-sand-100/75">{sub}</p>
            <div className="mt-8 hidden items-center gap-3 text-xs text-sand-100/60 lg:flex">
              <span className="inline-block h-px w-14 bg-clay-300" />
              اسکرول کن
            </div>
          </div>

          {products.map((p, i) => {
            const final = p.salePrice ?? p.price;
            return (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group relative flex w-[70vw] shrink-0 flex-col justify-end overflow-hidden rounded-3xl md:w-[38vw] lg:w-[26vw]"
                style={{ minHeight: "min(66svh, 620px)" }}
              >
                <Image
                  src={p.image}
                  alt={p.nameFa}
                  fill
                  sizes="(max-width: 768px) 70vw, 26vw"
                  // first cards are visible the moment the section pins; decoding
                  // them during the scrub is what makes the entry feel janky
                  loading={i < 2 ? "eager" : "lazy"}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-sea-900/85 via-sea-900/10 to-transparent" />
                <span className="absolute top-4 right-4 font-display text-5xl font-black text-sand-50/25">
                  {faNum(i + 1).padStart(2, "۰")}
                </span>
                {p.salePrice && (
                  <span className="chip absolute top-5 left-5 bg-clay-500 text-sand-50">
                    ٪{faNum(discountPct(p.price, p.salePrice))}
                  </span>
                )}
                <div className="relative p-6">
                  <h3 className="font-display text-2xl font-bold leading-9">{p.nameFa}</h3>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-lg font-extrabold text-clay-300">{toman(final)}</span>
                    {p.salePrice && (
                      <span className="text-sm text-sand-100/50 line-through">{faNum(p.price)}</span>
                    )}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-sand-100/80 transition-colors group-hover:text-sand-50">
                    دیدن محصول
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="rotate-180">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}

          {/* outro card */}
          <div className="flex w-[70vw] shrink-0 items-center justify-center md:w-[30vw] lg:w-[24vw]">
            <Link
              href="/products"
              className="group flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full border border-sand-100/30 text-center transition-all duration-300 hover:border-clay-300 hover:bg-clay-500/10 md:h-52 md:w-52"
            >
              <span className="font-display text-2xl font-bold">همه محصولات</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="rotate-180 transition-transform group-hover:-translate-x-1">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
