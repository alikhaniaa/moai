"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Product gallery: a swipeable main image, click-through zones, arrows and a
 * thumbnail strip.
 *
 * The main image is a horizontal scroll-snap carousel, so on a phone you swipe
 * through the photos. On any device you can also click the left or right third
 * of the photo to step through them, or use the arrow keys.
 *
 * Clicking is handled on the track itself rather than with overlay elements on
 * purpose: an overlay would have to swallow horizontal touch gestures, which
 * would kill the swipe. A browser suppresses the click that ends a drag, so
 * reading the pointer's x-position inside the normal click event gives us
 * click-to-advance and swipe at the same time, with neither getting in the
 * other's way.
 *
 * Plain <img> (not next/image) is used on purpose: the site runs with the image
 * optimizer off, and <img> has no intrinsic-width min-content, which is what
 * used to blow the mobile layout past the screen edge.
 */
export default function ProductGallery({
  images,
  alt,
  badge,
  index,
  onIndexChange,
}: {
  images: string[];
  alt: string;
  badge?: string | null;
  /** the photo on show, owned by the parent so a colour swatch can drive it */
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const pics = images;
  const trackRef = useRef<HTMLDivElement>(null);
  /** set while WE are scrolling the track, so the scroll handler doesn't fight back */
  const programmatic = useRef(false);

  const active = Math.min(Math.max(index, 0), Math.max(0, pics.length - 1));

  // The track is forced dir="ltr" (like the site's marquee) so scroll math is
  // normal - in an RTL container scrollLeft goes negative and this all breaks.
  // Slides are exactly one track-width wide, so slide i sits at i × clientWidth.
  const scrollTo = useCallback((i: number, smooth: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    programmatic.current = true;
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    // a smooth scroll finishes well after this returns
    window.setTimeout(() => { programmatic.current = false; }, smooth ? 450 : 60);
  }, []);

  // Follow the parent: picking «آبی» moves the gallery to the blue photo.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const at = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (at !== active) scrollTo(active, true);
  }, [active, scrollTo]);

  const step = (delta: number) => {
    const next = active + delta;
    if (next < 0 || next >= pics.length) return;
    onIndexChange(next);
    scrollTo(next, true);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || programmatic.current) return;
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i !== active && i >= 0 && i < pics.length) onIndexChange(i);
  };

  /** Left third → previous, right third → next; the middle is left alone. */
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pics.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.34) step(-1);
    else if (x > 0.66) step(1);
  };

  if (pics.length === 0) return null;

  return (
    <div className="min-w-0">
      <div
        className="group relative overflow-hidden rounded-3xl bg-sand-100"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        }}
        tabIndex={pics.length > 1 ? 0 : -1}
        role={pics.length > 1 ? "group" : undefined}
        aria-label={pics.length > 1 ? `${alt} — ${pics.length} تصویر` : undefined}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          onClick={onTrackClick}
          dir="ltr"
          className={`flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            pics.length > 1 ? "cursor-pointer" : ""
          }`}
        >
          {pics.map((src, i) => (
            <div key={src} className="w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i === 0 ? alt : ""}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                className="block aspect-[4/5] w-full object-cover select-none"
              />
            </div>
          ))}
        </div>

        {badge && (
          <span className="chip absolute top-5 right-5 bg-clay-500 text-base text-sand-50">
            {badge}
          </span>
        )}

        {pics.length > 1 && (
          <>
            <Arrow side="left" disabled={active === 0} onClick={() => step(-1)} />
            <Arrow side="right" disabled={active === pics.length - 1} onClick={() => step(1)} />

            {/* dots - swipe position indicator */}
            <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
              {pics.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full bg-white shadow transition-all ${
                    i === active ? "w-5" : "w-1.5 opacity-60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* thumbnails */}
      {pics.length > 1 && (
        <div dir="ltr" className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pics.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => { onIndexChange(i); scrollTo(i, true); }}
              aria-label={`تصویر ${i + 1}`}
              aria-current={i === active}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-xl transition-all ${
                i === active ? "ring-2 ring-clay-500 ring-offset-2" : "opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sits above the track, so its own click must not also register as a click on
 * the photo behind it - hence stopPropagation.
 */
function Arrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      aria-label={side === "left" ? "تصویر قبلی" : "تصویر بعدی"}
      className={`absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-sand-50/85 text-sea-900 shadow-lg backdrop-blur transition-all hover:bg-sand-50 disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
