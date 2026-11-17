import Reveal from "./Reveal";

type Props = {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
  light?: boolean;
};

export default function SectionHeading({ eyebrow, title, sub, center, light }: Props) {
  return (
    <Reveal className={center ? "text-center" : ""}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2
        className={`font-display text-4xl font-bold leading-[1.15] md:text-6xl ${
          light ? "text-sand-50" : "text-sea-900"
        }`}
      >
        {title}
      </h2>
      {sub && (
        <p
          className={`mt-4 max-w-xl text-base leading-8 ${
            light ? "text-sand-200/90" : "text-ink/82"
          } ${center ? "mx-auto" : ""}`}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}
