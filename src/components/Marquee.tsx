type Props = {
  items: string[];
  className?: string;
  slow?: boolean;
  separator?: string;
};

/** Infinite scrolling strip. Content duplicated for a seamless loop. */
export default function Marquee({ items, className = "", slow, separator = "✦" }: Props) {
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          <span className="px-6">{item}</span>
          <span className="text-clay-400">{separator}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={`marquee-outer ${className}`}>
      <div className={`marquee-track ${slow ? "is-slow" : ""}`}>
        {row}
        {row}
      </div>
    </div>
  );
}
