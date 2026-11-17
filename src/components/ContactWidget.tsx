"use client";

import { useEffect, useRef, useState } from "react";
import type { ContactChannel } from "@/lib/settings";

/** Per-channel mark and chip colour. Keys come from `contactChannels()`. */
const ICON: Record<ContactChannel["key"], { chip: string; path: React.ReactNode; filled: boolean }> = {
  whatsapp: {
    chip: "bg-[#25D366]/12 text-[#128C7E]",
    filled: true,
    path: (
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.2 2.1-.6 3.5a12 12 0 0 0 4.6 4.9c1.7 1 2.6 1 3.5.8.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.2-.2-.3-.4-.4Z" />
    ),
  },
  // بله - a paper-plane message mark, drawn rather than fetched so the widget
  // stays free of external assets like everything else on the site
  bale: {
    chip: "bg-[#1f9c8b]/12 text-[#177f70]",
    filled: true,
    path: <path d="M21.4 3.3 2.9 10.5c-.7.3-.7 1.3.1 1.5l4.6 1.4 1.8 5c.2.7 1.1.8 1.5.2l2.4-3.1 4.6 3.4c.5.4 1.3.1 1.4-.6l2.6-14c.1-.7-.6-1.2-1.2-1h-.3ZM8.9 13l8.6-6-6.9 7.4-.3 3-1.4-4.4Z" />,
  },
  phone: {
    chip: "bg-clay-500/12 text-clay-600",
    filled: false,
    path: (
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
    ),
  },
};

/**
 * The floating «سوالی دارید؟» button, in the corner the WhatsApp shortcut used
 * to sit in. It opens a small card listing every channel the shop has filled in
 * - see `contactChannels()`, which is also what builds and sanitises the links.
 */
export default function ContactWidget({
  title,
  subtitle,
  channels,
}: {
  title: string;
  subtitle: string;
  channels: ContactChannel[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A tap anywhere else, or Escape, puts it away again.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (channels.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-20 left-5 z-[120] lg:bottom-5"
    >
      {/* the card - anchored to the button's bottom-left so it grows out of it */}
      <div
        className={`absolute bottom-full left-0 mb-3 flex max-h-[calc(100dvh-10rem)] w-[min(19rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl lg:max-h-[calc(100dvh-6.5rem)] origin-bottom-left border border-sand-200 bg-sand-50 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? "scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
      >
        <div className="shrink-0 bg-gradient-to-b from-sea-800 to-sea-700 px-5 py-4">
          <p className="font-display text-2xl font-bold leading-tight text-sand-50">{title}</p>
          <p className="mt-0.5 text-[0.8rem] leading-6 text-sand-200/85">{subtitle}</p>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {channels.map((c) => {
            const icon = ICON[c.key];
            return (
              <li key={c.key}>
                <a
                  href={c.href}
                  {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-sea-100/70"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${icon.chip}`}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill={icon.filled ? "currentColor" : "none"}
                      stroke={icon.filled ? "none" : "currentColor"}
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    >
                      {icon.path}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-sea-900">{c.label}</span>
                    <span dir="ltr" className="block truncate text-right text-xs text-ink/60">
                      {c.value}
                    </span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-sand-300">
                    <path d="M14 6l-6 6 6 6" />
                  </svg>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "بستن راه‌های ارتباطی" : title}
        className="grid h-13 w-13 place-items-center rounded-full bg-sea-700 text-sand-50 shadow-xl transition-transform hover:scale-110 active:scale-95"
      >
        {/* chat bubble ⇄ close, cross-faded in place */}
        <span className="relative grid h-6 w-6 place-items-center">
          <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className={`absolute transition-all duration-300 ${open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
          >
            <path d="M20.5 11.6a7.7 7.7 0 0 1-8.3 7.7c-.8 0-1.6-.1-2.3-.3L4.5 21l1.2-4a7.4 7.4 0 0 1-1.2-4.1 7.7 7.7 0 0 1 8-7.6 7.8 7.8 0 0 1 8 6.3Z" />
            <path d="M9.9 10.2a2.2 2.2 0 1 1 3 2.1v1.1" />
            <path d="M12.9 15.6h0" />
          </svg>
          <svg
            width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`absolute transition-all duration-300 ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      </button>
    </div>
  );
}
