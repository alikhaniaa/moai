"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsoLayoutEffect } from "@/lib/useIsoLayoutEffect";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  scale?: number;
  as?: "div" | "section" | "span" | "li";
};

/** Fades + slides content in when it scrolls into view. */
export default function Reveal({
  children,
  className,
  delay = 0,
  y = 44,
  scale = 1,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = gsap.fromTo(
      el,
      { autoAlpha: 0, y, scale },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 1.1,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
    return () => {
      anim.scrollTrigger?.kill();
      anim.kill();
    };
  }, [delay, y, scale]);

  // no inline hiding: if JS never runs (blocked assets, crawlers, ancient
  // browsers) content must still be visible - GSAP hides it pre-paint instead
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
