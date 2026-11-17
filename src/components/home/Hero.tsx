"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsoLayoutEffect } from "@/lib/useIsoLayoutEffect";
import { HERO_DEFAULTS, heroImageSrc, type HeroContent } from "@/lib/hero";

gsap.registerPlugin(ScrollTrigger);

export default function Hero({ content = HERO_DEFAULTS }: { content?: HeroContent }) {
  const root = useRef<HTMLElement>(null);
  const [image, setImage] = useState(heroImageSrc(content.landingImage));
  useEffect(() => { setImage(heroImageSrc(content.landingImage)); }, [content.landingImage]);

  useIsoLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // entrance
      gsap.fromTo(
        ".hero-bg",
        { scale: 1.18 },
        { scale: 1, duration: 2.4, ease: "power2.out" }
      );
      gsap.fromTo(
        ".hero-line",
        { yPercent: 115 },
        { yPercent: 0, stagger: 0.14, duration: 1.15, ease: "power4.out", delay: 0.25 }
      );
      gsap.fromTo(
        ".hero-soft",
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, stagger: 0.12, duration: 0.9, ease: "power3.out", delay: 0.9 }
      );
      gsap.fromTo(
        ".hero-card",
        { autoAlpha: 0, y: 80, rotate: -10 },
        { autoAlpha: 1, y: 0, rotate: -5, duration: 1.3, ease: "power3.out", delay: 0.7 }
      );

      // scroll parallax
      gsap.to(".hero-bg", {
        yPercent: 16,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-card", {
        y: -90,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-content", {
        y: 70,
        autoAlpha: 0.25,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom 25%", scrub: true },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative flex min-h-svh items-center overflow-hidden bg-sea-900"
    >
      {/* background */}
      <div className="hero-bg absolute inset-0 will-change-transform">
        <Image
          src={image}
          onError={() => setImage(HERO_DEFAULTS.landingImage)}
          alt={image === HERO_DEFAULTS.landingImage ? "ساحل، دریا و آرامش" : "تصویر اصلی موآی"}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900/90 via-sea-900/25 to-sea-900/10" />
      </div>

      <div className="hero-content relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-6 pb-28 pt-36 md:px-8 lg:grid-cols-12 lg:items-center lg:pb-20">
        {/* copy */}
        <div className="lg:col-span-7">
          <div className="hero-soft eyebrow !text-clay-300">از جنس آرامش، از جنس پنبه…</div>

          <h1 className="font-display font-black leading-[1.02] text-sand-50">
            <span className="block overflow-hidden">
              <span className="hero-line block break-words text-6xl [overflow-wrap:anywhere] md:text-8xl xl:text-[7.5rem]">
                {content.landingTitleFirst}
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="hero-line block break-words text-6xl [overflow-wrap:anywhere] md:text-8xl xl:text-[7.5rem]">
                <span className="text-clay-300">{content.landingTitleAccent}</span> {content.landingTitleLast}
              </span>
            </span>
          </h1>

          <p className="hero-soft mt-6 max-w-lg text-base leading-9 text-sand-100/85 md:text-lg">
            حوله و زیرانداز ساحلیِ دست‌دوز از الیاف طبیعی نخ پنبه؛ طراحی‌شده برای
            سفر، دریا و لحظه‌هایی که می‌خواهی مالِ خودت باشند.
          </p>

          <div className="hero-soft mt-9 flex flex-wrap items-center gap-4">
            <Link href={content.landingButtonHref} className="btn btn-primary max-w-full break-words text-base" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
              {content.landingButtonText}
            </Link>
            <Link href="/about" className="btn btn-ghost !border-sand-100/40 !text-sand-50 hover:!bg-white/10">
              قصه موآی
            </Link>
          </div>

          <div className="hero-soft mt-10 flex flex-wrap gap-3 text-xs font-semibold text-sand-100/80">
            <span className="chip border border-white/15 bg-white/10 backdrop-blur">۱۰۰٪ پنبه طبیعی</span>
            <span className="chip border border-white/15 bg-white/10 backdrop-blur">دست‌دوز تهران</span>
            <span className="chip border border-white/15 bg-white/10 backdrop-blur">ارسال ۵ روز کاری به سراسر ایران</span>
          </div>
        </div>

        {/* floating polaroid + rotating badge */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <div
            className="hero-card relative mx-auto w-72 xl:w-80"
            style={{ "--float-rot": "-5deg" } as React.CSSProperties}
          >
            <div className="animate-float rounded-3xl bg-sand-50 p-3 pb-10 shadow-2xl">
              <div className="img-frame !rounded-2xl">
                <Image
                  src="/images/aerial.jpg"
                  alt="ساحل از نمای بالا"
                  width={320}
                  height={420}
                  priority
                  className="h-80 w-full object-cover xl:h-96"
                />
              </div>
              <p className="mt-4 text-center font-script text-xl text-sea-800">
                دریا حالِ آدم را خوب می‌کند
              </p>
            </div>
          </div>

          <div className="absolute -bottom-6 -right-2 h-32 w-32 animate-spin-slow xl:h-36 xl:w-36" dir="ltr">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <defs>
                <path id="circ" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
              </defs>
              <text className="fill-sand-50 text-[8.5px] font-semibold tracking-[0.22em]">
                {/* textLength = circle circumference (2π×37) so the loop closes seamlessly */}
                <textPath href="#circ" textLength="232" lengthAdjust="spacingAndGlyphs">
                  MOAI GALLERY • HANDMADE • COTTON •{" "}
                </textPath>
              </text>
              <circle cx="50" cy="50" r="26" className="fill-clay-500/90" />
              <text x="50" y="55" textAnchor="middle" className="fill-sand-50 text-[13px] font-bold">
                ☀
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* scroll hint */}
      <div className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-sand-100/70">
        <div className="mx-auto h-10 w-6 rounded-full border border-current p-1">
          <div className="mx-auto h-2 w-1 animate-bounce rounded-full bg-current" />
        </div>
      </div>
    </section>
  );
}
