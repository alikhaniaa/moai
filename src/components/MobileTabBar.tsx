"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

/**
 * Sticky bottom quick-nav for phones. Slides up once the visitor scrolls past
 * the hero, so it never covers the top of a page. Mobile only (hidden ≥ lg).
 */
export default function MobileTabBar() {
  const [visible, setVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { count, setOpen } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // hysteresis: appear once you're a little way down, and stay put until you're
    // back near the very top - so a small scroll-up never makes it flicker away
    const onScroll = () => {
      const y = window.scrollY;
      setVisible((v) => (y > 220 ? true : y < 70 ? false : v));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 60);
  }, [searchOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setSearchOpen(false);
    setTerm("");
    router.push(`/products?q=${encodeURIComponent(q)}`);
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* search sheet */}
      <div
        className={`fixed inset-0 z-[160] bg-sea-900/40 backdrop-blur-sm transition-opacity lg:hidden ${
          searchOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSearchOpen(false)}
      >
        <form
          onSubmit={submitSearch}
          onClick={(e) => e.stopPropagation()}
          className={`absolute inset-x-0 top-0 flex gap-2 bg-sand-50 p-4 shadow-lg transition-transform ${
            searchOpen ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="دنبال چه می‌گردی؟ مثلاً پانچو…"
            className="input flex-1"
          />
          <button type="submit" className="btn btn-primary !px-5">
            بگرد
          </button>
        </form>
      </div>

      {/* bottom bar - opaque and flush to the bottom; Safari provides its own
          bottom-chrome spacing, so we only add the home-indicator inset when the
          browser actually reports one (avoids an awkward gap in Safari) */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-[110] border-t border-sand-200 bg-sand-50 transition-transform duration-200 lg:hidden ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px) - 0.5rem, 0px)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          <Tab href="/" label="خانه" active={isActive("/")}>
            <path d="M4 11.5 12 5l8 6.5" />
            <path d="M6 10v9h12v-9" />
          </Tab>
          <Tab href="/products" label="فروشگاه" active={isActive("/products")}>
            <path d="M6 8h12l-1 12H7L6 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </Tab>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-sea-900"
            aria-label="جستجو"
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <span className="text-[10px] font-semibold">جستجو</span>
          </button>

          <button
            onClick={() => setOpen(true)}
            className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-sea-900"
            aria-label="سبد خرید"
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l-1 12H7L6 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {count > 0 && (
              <span className="absolute top-1.5 left-1/2 grid h-4 min-w-4 translate-x-2 place-items-center rounded-full bg-clay-500 px-1 text-[9px] font-bold text-sand-50">
                {count.toLocaleString("fa-IR")}
              </span>
            )}
            <span className="text-[10px] font-semibold">سبد</span>
          </button>

          <a
            href="https://wa.me/989121230000"
            target="_blank"
            rel="noopener"
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-sea-900"
            aria-label="واتساپ"
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.2 2.1-.6 3.5a12 12 0 0 0 4.6 4.9c1.7 1 2.6 1 3.5.8.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.2-.2-.3-.4-.4Z" />
            </svg>
            <span className="text-[10px] font-semibold">واتساپ</span>
          </a>
        </div>
      </nav>
    </>
  );
}

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 ${
        active ? "text-clay-600" : "text-sea-900"
      }`}
    >
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}
