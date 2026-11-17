"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import EventBar from "@/components/EventBar";
import type { EventBannerData } from "@/lib/appearance";

const LINKS = [
  { href: "/", label: "خانه" },
  { href: "/products", label: "فروشگاه" },
  // right after فروشگاه on purpose: "which size am I?" is the question that
  // stops a first-time buyer, and it needs no account to answer
  { href: "/size-guide", label: "راهنمای سایز" },
  { href: "/club", label: "باشگاه موآی" },
  { href: "/about", label: "قصه موآی" },
  { href: "/contact", label: "تماس" },
];

export default function Navbar({
  loggedIn,
  announcement,
  event,
}: {
  loggedIn: boolean;
  announcement?: string;
  event?: EventBannerData | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, setOpen } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] transition-all duration-500 ${
          scrolled
            ? "bg-sand-50/85 shadow-[0_8px_30px_-18px_rgba(15,44,40,0.35)] backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        {/* announcement sits inside the header so it takes real space instead of
            floating over the nav; it slides away once the user scrolls */}
        {event ? (
          <div className={`overflow-hidden transition-all duration-500 motion-reduce:transition-none ${scrolled ? "max-h-0 opacity-0" : "max-h-12 opacity-100"}`}>
            <EventBar event={event} />
          </div>
        ) : announcement?.trim() && (
          <div
            className={`overflow-hidden bg-sea-900 text-center text-xs font-semibold text-sand-100 transition-all duration-500 ${
              scrolled ? "max-h-0 py-0 opacity-0" : "max-h-12 py-2 opacity-100"
            }`}
          >
            {announcement}
          </div>
        )}

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
          {/* logo */}
          <Link href="/" className="group flex items-center" aria-label="موآی گالری">
            {/* A plain <img> because the image optimizer is off (see next.config).
                width/height are the file's real pixels so the bar reserves the
                right space and the logo cannot shift the nav as it loads. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/moai-logo.png"
              alt="موآی گالری"
              width={595}
              height={300}
              loading="eager"
              fetchPriority="high"
              className="h-[42px] w-auto md:h-[52px]"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`relative text-sm font-semibold transition-colors after:absolute after:-bottom-1.5 after:right-0 after:h-0.5 after:rounded-full after:bg-clay-500 after:transition-all after:duration-300 hover:text-clay-600 ${
                  pathname === l.href
                    ? "text-clay-600 after:w-full"
                    : "text-sea-900 after:w-0 hover:after:w-full"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href={loggedIn ? "/account" : "/login"}
              aria-label="حساب کاربری"
              className="grid h-10 w-10 place-items-center rounded-full text-sea-900 transition-colors hover:bg-sea-900/5"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="8" r="3.6" />
                <path d="M5 20c1.3-3.4 4-5 7-5s5.7 1.6 7 5" />
              </svg>
            </Link>
            <button
              onClick={() => setOpen(true)}
              aria-label="سبد خرید"
              className="relative grid h-10 w-10 place-items-center rounded-full text-sea-900 transition-colors hover:bg-sea-900/5"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8h12l-1 12H7L6 8Z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
              {count > 0 && (
                <span className="absolute -top-0.5 -left-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-sand-50">
                  {count.toLocaleString("fa-IR")}
                </span>
              )}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="منو"
              className="grid h-10 w-10 place-items-center rounded-full text-sea-900 hover:bg-sea-900/5 lg:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h10M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* mobile full-screen menu */}
      <div
        className={`fixed inset-0 z-[150] flex flex-col bg-sea-900 text-sand-50 transition-[clip-path] duration-700 ease-[cubic-bezier(0.83,0,0.17,1)] lg:hidden ${
          menuOpen
            ? "[clip-path:circle(150%_at_85%_5%)]"
            : "pointer-events-none [clip-path:circle(0%_at_85%_5%)]"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {/* light variant: this panel is sea-900 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/moai-logo-light.png"
            alt="موآی گالری"
            width={595}
            height={300}
            className="h-[38px] w-auto"
          />
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="بستن"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-1 flex-col items-start justify-center gap-2 px-8">
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ transitionDelay: menuOpen ? `${150 + i * 60}ms` : "0ms" }}
              className={`font-display text-5xl font-bold leading-snug transition-all duration-500 hover:text-clay-300 ${
                menuOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="px-8 pb-10 text-sm text-sea-300" dir="ltr">
          moai.gallery · ۰۹۱۲۱۲۳۰۰۰۰
        </div>
      </div>
    </>
  );
}
