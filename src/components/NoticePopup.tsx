"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PopupNotice } from "@/lib/settings";

/** One notice per browser session - navigating the shop must not re-open it. */
const SEEN_KEY = "moai_notice_seen";

/**
 * The shop's «توجه» card, opened a few seconds after a visit starts.
 *
 * Whether it should exist at all - switched on, worded, and inside its date
 * window - is decided on the server by `popupNotice()`; this component only
 * owns the timing and the dismissal. `notice.version` changes with the wording,
 * so re-writing the notice shows it again to someone who already dismissed the
 * previous one.
 */
export default function NoticePopup({ notice }: { notice: PopupNotice }) {
  const [mounted, setMounted] = useState(false); // in the DOM
  const [open, setOpen] = useState(false); // …and animated in
  const [copied, setCopied] = useState(false);

  /**
   * Copy the code. `navigator.clipboard` is unavailable over plain HTTP and in
   * a few in-app browsers, so a hidden textarea is kept as the fallback rather
   * than leaving the button silently dead.
   */
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement("textarea");
      el.value = code;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const panelRef = useRef<HTMLDivElement>(null);

  // Open once, `delayMs` after the visitor lands.
  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = sessionStorage.getItem(SEEN_KEY);
    } catch {
      // private mode with storage blocked - show it, just don't remember
    }
    if (seen === notice.version) return;

    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, notice.version);
      } catch {}
      setMounted(true);
      // a frame later, so the entrance transition has a "from" state to run from
      requestAnimationFrame(() => setOpen(true));
    }, notice.delayMs);

    return () => clearTimeout(timer);
  }, [notice.delayMs, notice.version]);

  const close = useCallback(() => {
    setOpen(false);
    setTimeout(() => setMounted(false), 350); // let it animate out first
  }, []);

  // Escape closes it, and the page behind stays put while it is up.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [mounted, close]);

  // Focus moves into the card so Escape and screen readers reach it, but onto
  // the card itself - focusing the button would paint a ring on it at rest.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[260] flex items-center justify-center p-5 transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-title"
    >
      <div onClick={close} className="absolute inset-0 bg-sea-900/55 backdrop-blur-sm" />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border border-sand-200 bg-sand-50 shadow-2xl outline-none transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? "translate-y-0 scale-100" : "translate-y-6 scale-95"
        }`}
      >
        {/* sea-green crown, washed into the card by a wave */}
        <div className="relative h-26 bg-gradient-to-b from-sea-800 to-sea-700">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.16),transparent_62%)]" />
          <button
            onClick={close}
            aria-label="بستن"
            className="absolute top-3.5 left-3.5 grid h-9 w-9 place-items-center rounded-full text-sand-100/85 transition-colors hover:bg-white/12 hover:text-sand-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <svg
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            aria-hidden
            className="absolute inset-x-0 bottom-0 block h-8 w-full text-sand-50"
          >
            <path
              fill="currentColor"
              d="M0,48 C120,78 240,90 360,78 C480,66 600,30 720,24 C840,18 960,42 1080,54 C1200,66 1320,60 1440,36 L1440,90 L0,90 Z"
            />
          </svg>
        </div>

        {/* the badge straddles the wave */}
        <div className="relative -mt-9 grid place-items-center">
          <span className="grid h-18 w-18 place-items-center rounded-full border-4 border-sand-50 bg-clay-500 text-3xl font-black text-sand-50 shadow-lg">
            !
          </span>
        </div>

        <div className="px-8 pb-8 pt-4 text-center">
          <h2 id="notice-title" className="font-display text-4xl font-bold text-sea-900">
            {notice.title}
          </h2>
          <div className="mx-auto mt-3 h-px w-14 bg-clay-400" />
          <p className="mt-5 whitespace-pre-line text-[0.97rem] leading-8 text-ink/80">
            {notice.text}
          </p>

          {/* The code the notice is about, one tap to copy. The text is also
              selectable, because the clipboard API is refused outside a secure
              context and in some in-app browsers - there a long-press still works. */}
          {notice.code && (
            <div className="mt-5 flex items-stretch gap-2 rounded-2xl border border-dashed border-clay-400 bg-clay-500/8 p-2">
              <code
                dir="ltr"
                className="flex flex-1 select-all items-center justify-center px-2 text-lg font-black tracking-[0.18em] text-clay-700"
              >
                {notice.code}
              </code>
              <button
                type="button"
                onClick={() => copyCode(notice.code)}
                className={copied
                  ? "shrink-0 rounded-xl bg-sea-600 px-4 py-2.5 text-sm font-bold text-sand-50"
                  : "shrink-0 rounded-xl bg-clay-500 px-4 py-2.5 text-sm font-bold text-sand-50 transition-colors hover:bg-clay-600"}
              >
                {copied ? "کپی شد ✓" : "کپی کد"}
              </button>
            </div>
          )}
          <button onClick={close} className="btn btn-primary mt-7 w-full">
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
}
