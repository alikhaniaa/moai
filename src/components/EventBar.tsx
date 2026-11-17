import type { EventBannerData, EventMotif } from "@/lib/appearance";

function Motif({ kind }: { kind: EventMotif }) {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32" fill="none" aria-hidden="true" className="shrink-0">
      {kind === "pumpkin" ? <>
        <path d="M20 11c-1-5 2-7 5-7" stroke="#86a65e" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="20" cy="24" rx="16" ry="12" fill="currentColor" />
        <ellipse cx="20" cy="24" rx="8" ry="12" stroke="#683419" strokeOpacity=".35" strokeWidth="1.5" />
        <path d="m10 21 5-4 3 5zm12 1 3-5 5 4zM12 27l5 2 3-2 3 2 5-2-4 6h-8z" fill="#30203e" />
      </> : kind === "pomegranate" ? <>
        <path d="m15 8-1-5 6 3 6-3-1 5" fill="currentColor" />
        <circle cx="20" cy="23" r="14" fill="currentColor" />
        <path d="M20 12c-12 2-12 20 0 22V12Z" fill="#a02b43" />
        {[ [14,18], [11,23], [16,24], [13,29] ].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" fill="#fff1df" />)}
      </> : kind === "leaf" ? <>
        <path d="M31 6C9 6 3 16 10 27c11 7 21 1 21-21Z" fill="currentColor" />
        <path d="m7 34 21-23M17 24l-1-8m5 4 7 1" stroke="#63391f" strokeWidth="2" strokeLinecap="round" />
      </> : kind === "fire" ? <>
        <path d="M21 3c2 12 15 13 13 24-1 7-7 10-14 10S7 32 7 25c0-6 5-9 7-14 0 5 3 7 4 8 4-6 4-11 3-16Z" fill="currentColor" />
        <path d="M20 21c0 6-7 6-6 11 1 5 11 5 12-1 0-4-4-6-6-10Z" fill="#fff5e5" />
      </> : kind === "snow" ? <>
        <path d="M20 4v32M6 12l28 16M6 28l28-16M15 7l5 5 5-5M15 33l5-5 5 5M7 18l7-2-2-7m16 22-2-7 7-2M7 22l7 2-2 7m16-22-2 7 7 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </> : kind === "heart" ? <>
        <path d="M20 34 6 20C-2 9 13 1 20 12 27 1 42 9 34 20L20 34Z" fill="currentColor" />
        <path d="M10 13c1-3 4-3 6-1" stroke="#fff3ee" strokeWidth="2" strokeLinecap="round" />
      </> : kind === "earth" ? <>
        <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="20" cy="20" rx="7" ry="15" stroke="currentColor" strokeWidth="2" />
        <path d="M5 20h30M8 12h24M8 28h24" stroke="currentColor" strokeWidth="2" />
      </> : kind === "flower" ? <>
        {[0,60,120,180,240,300].map((angle) => <ellipse key={angle} cx="20" cy="10" rx="5" ry="8" fill="currentColor" transform={`rotate(${angle} 20 20)`} />)}
        <circle cx="20" cy="20" r="5" fill="#fff8e7" />
      </> : <path d="m20 3 5 11 12 2-9 9 2 12-10-6-10 6 2-12-9-9 12-2Z" fill="currentColor" />}
    </svg>
  );
}

export default function EventBar({ event }: { event: EventBannerData }) {
  return (
    <div data-event-bar={event.id} className="relative overflow-hidden" style={{ background: event.background, color: event.foreground }}>
      {event.decorated && <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 12% 25%, ${event.accent} 1px, transparent 2px), radial-gradient(circle at 82% 70%, ${event.accent} 1px, transparent 2px)`, backgroundSize: "64px 32px" }} />}
      <div className="relative mx-auto flex h-12 max-w-5xl items-center justify-center gap-3 px-4 py-1.5">
        {event.decorated && <span aria-hidden="true" style={{ color: event.accent }}><Motif kind={event.motif} /></span>}
        <p title={event.text} className="min-w-0 line-clamp-2 text-center text-xs font-semibold leading-4 [overflow-wrap:anywhere] md:text-sm">{event.text}</p>
        {event.decorated && <span aria-hidden="true" className="hidden sm:block" style={{ color: event.accent, transform: "rotate(-12deg)" }}><Motif kind={event.motif} /></span>}
      </div>
    </div>
  );
}
