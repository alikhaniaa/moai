type Props = {
  className?: string;
  flip?: boolean;
};

/** Organic wave section divider. Color via text-* class (uses currentColor). */
export default function WaveDivider({ className = "", flip }: Props) {
  return (
    <svg
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden
      className={`block h-14 w-full md:h-20 ${flip ? "rotate-180" : ""} ${className}`}
    >
      <path
        fill="currentColor"
        d="M0,48 C120,78 240,90 360,78 C480,66 600,30 720,24 C840,18 960,42 1080,54 C1200,66 1320,60 1440,36 L1440,90 L0,90 Z"
      />
    </svg>
  );
}
