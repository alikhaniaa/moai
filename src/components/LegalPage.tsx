import Link from "next/link";

/** A paragraph may be plain text or markup, so a section can carry a link. */
export type Section = { title: string; body: React.ReactNode[] };

const LEGAL_LINKS = [
  { href: "/terms", label: "قوانین و مقررات" },
  { href: "/privacy", label: "حریم خصوصی" },
  { href: "/returns", label: "شرایط بازگشت کالا" },
  { href: "/faq", label: "سوالات متداول" },
];

export default function LegalPage({
  title,
  intro,
  sections,
  current,
  updated = "تیر ۱۴۰۵",
}: {
  title: string;
  intro: string;
  sections: Section[];
  current: string;
  updated?: string;
}) {
  return (
    <>
      <section className="bg-sea-900 pb-20 pt-40 text-center text-sand-50">
        <h1 className="font-display text-4xl font-black md:text-6xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl px-6 leading-8 text-sand-100/80">{intro}</p>
        <p className="mt-4 text-xs text-sand-100/50">آخرین به‌روزرسانی: {updated}</p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 md:px-8">
        <nav className="mb-12 flex flex-wrap justify-center gap-2">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`chip transition-colors ${
                current === l.href
                  ? "bg-clay-500 text-sand-50"
                  : "bg-sand-100 text-ink/75 hover:bg-sand-200"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-10">
          {sections.map((s, i) => (
            <div key={s.title} className="card p-7 md:p-9">
              <h2 className="mb-4 flex items-baseline gap-3 font-display text-2xl font-bold text-sea-900">
                <span className="font-display text-3xl font-black text-sand-300">
                  {(i + 1).toLocaleString("fa-IR")}
                </span>
                {s.title}
              </h2>
              <div className="space-y-4">
                {s.body.map((p, j) => (
                  <p key={j} className="text-sm leading-9 text-ink/88">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-sand-100 p-8 text-center">
          <p className="leading-8 text-ink/82">
            سوالی برایت باقی مانده؟ ما همیشه در دسترسیم.
          </p>
          <Link href="/contact" className="btn btn-primary mt-5">تماس با ما</Link>
        </div>
      </section>
    </>
  );
}
