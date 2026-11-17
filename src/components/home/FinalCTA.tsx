import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <Image src="/images/wave.jpg" alt="" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-l from-sea-900/90 via-sea-900/70 to-clay-700/60" />
      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 py-28 text-center md:px-8 md:py-36">
        <Reveal>
          <p className="font-script text-2xl text-clay-300 md:text-3xl">
            موج که بیاید، دیگر منتظر نمی‌ماند…
          </p>
          <h2 className="mt-4 font-display text-5xl font-black leading-[1.1] text-sand-50 md:text-7xl">
            همین حالا تابستانت را بساز
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/products" className="btn btn-light text-base">
              رفتن به فروشگاه
            </Link>
            <a
              href="https://wa.me/989121230000"
              target="_blank"
              rel="noopener"
              className="btn btn-ghost !border-sand-100/40 !text-sand-50 hover:!bg-white/10"
            >
              مشاوره در واتس‌اپ
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
