import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import { faNum } from "@/lib/format";
import type { StoryPhotos } from "@/lib/banners";

export default function Story({
  followers = 7500,
  productCount = 124,
  photos,
}: {
  /** live numbers from تنظیمات → آمار برند, so this section never goes stale */
  followers?: number;
  productCount?: number;
  /** the collage, editable in پنل مدیریت → بنرها → «عکس‌های بخش قصه ما» */
  photos: StoryPhotos;
}) {
  const STATS = [
    { value: `${faNum(followers)}+`, label: "همراه در اینستاگرام" },
    { value: faNum(productCount), label: "طرح و محصول" },
    { value: "٪۱۰۰", label: "پنبه طبیعی" },
    { value: faNum(5), label: "روز کاری تا درِ خانه" },
  ];
  return (
    <section className="overflow-hidden bg-sand-100 py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:px-8 lg:grid-cols-2">
        {/* collage */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <Reveal>
            <div className="img-frame rotate-2">
              <Image
                src={photos.main.url}
                alt={photos.main.alt}
                width={640}
                height={780}
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={0.2} className="absolute -bottom-10 -right-4 w-44 md:w-56">
            <div className="-rotate-6 rounded-2xl bg-sand-50 p-2.5 pb-8 shadow-xl">
              <Image
                src={photos.inset.url}
                alt={photos.inset.alt}
                width={280}
                height={340}
                className="aspect-[4/5] w-full rounded-xl object-cover"
              />
              <p className="mt-2 text-center font-script text-base text-clay-600">
                {photos.inset.caption}
              </p>
            </div>
          </Reveal>
        </div>

        {/* copy */}
        <div>
          <Reveal>
            <div className="eyebrow">قصه ما</div>
            <h2 className="font-display text-4xl font-bold leading-[1.15] text-sea-900 md:text-6xl">
              از یک کارگاه کوچک،
              <br />
              برای دریاهای بزرگ
            </h2>
            <p className="mt-6 max-w-lg text-base leading-9 text-ink/82">
              موآی از عشق به سفر و پارچه‌های خوب شروع شد. هر حوله و زیرانداز،
              دست‌دوزِ کارگاه خودمان در تهران است؛ با پارچه‌ی نخیِ صددرصد طبیعی،
              دوخت تمیز و طرح‌هایی که جای دیگر پیدا نمی‌کنی — بعضی‌هایشان از
              اولین‌ها در ایران‌اند، مثل تن‌پوشِ پانچو که هم حوله است و هم
              رومایویی.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08}>
                <div className="border-r-2 border-clay-400 pr-4">
                  <div className="font-display text-3xl font-black text-sea-900 md:text-4xl">{s.value}</div>
                  <div className="mt-1 text-xs text-ink/75">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2} className="mt-10">
            <Link href="/about" className="btn btn-dark">
              بیشتر بخوان
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
