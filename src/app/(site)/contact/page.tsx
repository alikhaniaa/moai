import Reveal from "@/components/Reveal";

export const metadata = { title: "تماس با ما" };

const CARDS = [
  {
    icon: "💬",
    title: "واتس‌اپ",
    desc: "سریع‌ترین راه — همه‌روزه پاسخگوییم",
    action: { label: "شروع گفتگو", href: "https://wa.me/989121230000" },
  },
  {
    icon: "📞",
    title: "تلفن",
    desc: "۰۹۱۲۱۲۳۰۰۰۰",
    action: { label: "تماس بگیر", href: "tel:09121230000" },
  },
  {
    icon: "📸",
    title: "اینستاگرام",
    desc: "moai.gallery — پشت‌صحنه و طرح‌های جدید",
    action: { label: "دنبال کن", href: "https://instagram.com/moai.gallery" },
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="bg-sea-900 pb-24 pt-44 text-center text-sand-50">
        <div className="eyebrow !text-clay-300">حرف بزنیم…</div>
        <h1 className="font-display text-5xl font-black md:text-7xl">تماس با ما</h1>
        <p className="mx-auto mt-5 max-w-lg px-6 leading-8 text-sand-100/80">
          چه برای ثبت سفارش، چه مشاوره‌ی انتخاب و چه همکاری‌های جدید — همیشه
          خوشحال می‌شویم صدایت را بشنویم.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="card flex h-full flex-col items-center p-8 text-center">
                <span className="text-5xl">{c.icon}</span>
                <h2 className="mt-4 font-display text-2xl font-bold text-sea-900">{c.title}</h2>
                <p className="mt-2 text-sm text-ink/75" dir="auto">{c.desc}</p>
                <a
                  href={c.action.href}
                  target={c.action.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener"
                  className="btn btn-primary mt-6"
                >
                  {c.action.label}
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          <div className="card grid gap-8 p-8 md:grid-cols-2 md:p-10">
            <div>
              <h2 className="font-display text-2xl font-bold text-sea-900">موآی گالری</h2>
              <p className="mt-3 leading-8 text-ink/80">
                تهران
              </p>
              <div className="mt-6 space-y-2 text-sm leading-7 text-ink/80">
                <p>🕐 پاسخگویی: همه‌روزه ۹ تا ۲۱</p>
                <p>🚚 ارسال با تیپاکس به سراسر ایران</p>
              </div>
            </div>
            <div className="grid min-h-48 place-items-center rounded-2xl bg-gradient-to-br from-sea-800 to-sea-900 p-8 text-center text-sand-50">
              <div>
                <div className="text-4xl">🌊</div>
                <p className="mt-3 font-display text-xl font-bold">با عشق، دست‌دوزِ ایران</p>
                <p className="mt-1 text-sm text-sand-100/70">هر سفارش، مثل یک هدیه بسته‌بندی می‌شود</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
