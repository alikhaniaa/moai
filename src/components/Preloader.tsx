"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/** Cinematic intro curtain - plays once per session. */
export default function Preloader() {
  const [show, setShow] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem("moai_intro_seen")) return;
    sessionStorage.setItem("moai_intro_seen", "1");
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show || !rootRef.current) return;
    const q = gsap.utils.selector(rootRef.current);
    const tl = gsap.timeline({
      onComplete: () => setShow(false),
    });
    tl.fromTo(
      q(".intro-letter"),
      { yPercent: 120, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, stagger: 0.07, duration: 0.7, ease: "power3.out" }
    )
      .fromTo(
        q(".intro-line"),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6, ease: "power2.inOut" },
        "-=0.2"
      )
      .fromTo(
        q(".intro-sub"),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.5 },
        "-=0.3"
      )
      .to(rootRef.current, {
        yPercent: -100,
        duration: 0.85,
        delay: 0.45,
        ease: "power4.inOut",
      });
    return () => {
      tl.kill();
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-sea-900 text-sand-50"
    >
      <div className="flex gap-3 overflow-hidden text-6xl font-black tracking-widest md:text-8xl" dir="ltr">
        {"MOAI".split("").map((ch, i) => (
          <span key={i} className="intro-letter inline-block font-display">
            {ch}
          </span>
        ))}
      </div>
      <div className="intro-line mt-6 h-px w-40 origin-center bg-clay-400" />
      <p className="intro-sub mt-4 text-sm text-sea-300">
        حوله و زیرانداز ساحلی · از جنس الیاف طبیعی
      </p>
    </div>
  );
}
