import Reveal from "@/components/Reveal";

const FEATURES = [
  {
    title: "دست‌دوزِ کارگاه خودمان",
    desc: "هر محصول با دوخت تمیز و وسواس، در تهران دوخته می‌شود.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="M8 7.5 20 20M8 16.5 20 4" />
      </svg>
    ),
  },
  {
    title: "الیاف طبیعی پنبه",
    desc: "لطیف روی پوست، جاذب و بادوام — بدون الیاف مصنوعی.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3c3 3 6 5.5 6 9a6 6 0 0 1-12 0c0-3.5 3-6 6-9Z" />
        <path d="M12 21v-6" />
      </svg>
    ),
  },
  {
    title: "ارسال ۵ روز کاری",
    desc: "به تمام نقاط ایران، با بسته‌بندی مطمئن و خوش‌سلیقه.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="17" r="1.8" />
        <circle cx="17" cy="17" r="1.8" />
      </svg>
    ),
  },
  {
    title: "پاسخگو در واتس‌اپ",
    desc: "قبل و بعد از خرید کنارت هستیم؛ مشاوره، پیگیری، تعویض.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12Z" />
        <path d="M9 11h6M9 14h4" />
      </svg>
    ),
  },
];

export default function FeatureBand() {
  return (
    <section className="border-y border-sand-200 bg-sand-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <div className="flex gap-4">
              <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-sea-100 p-3 text-sea-700">
                {f.icon}
              </div>
              <div>
                <h3 className="font-bold text-sea-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-7 text-ink/75">{f.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
