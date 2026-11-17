import Link from "next/link";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import { toman, faNum, discountPct } from "@/lib/format";
import type { ProductCardData } from "@/components/ProductCard";

/**
 * «نسخه محدود» - one piece, shown big.
 *
 * The whole point of the section is scarcity, so it shows a single product
 * rather than a row of four: the shop puts the piece it wants seen at the top
 * of the نسخه محدود list in «صفحه اصلی», and everything else in that list is a
 * click away behind «همه‌ی نسخه‌های محدود».
 *
 * The ribbon down the side of the photo is what makes it read as limited at a
 * glance, whatever the photo happens to be.
 */
export default function LimitedEdition({
  eyebrow,
  title,
  sub,
  product,
  moreCount,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  product: ProductCardData;
  /** how many other limited pieces are behind «مشاهده همه» */
  moreCount: number;
}) {
  const onSale = product.salePrice !== null && product.salePrice < product.price;
  const final = product.salePrice ?? product.price;

  return (
    <section className="bg-sand-100/70 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />

          {moreCount > 0 && (
            <Link
              href="/products?limited=1"
              className="group inline-flex items-center gap-3 rounded-full border border-sea-800/20 bg-sand-50 px-6 py-3 text-sm font-bold text-sea-900 transition-colors hover:border-sea-800/40 hover:bg-white"
            >
              همه‌ی نسخه‌های محدود
              <span className="chip bg-sea-100 !px-2.5 !py-0.5 text-[11px] text-sea-700">
                {faNum(moreCount + 1)}
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-sea-800 text-sand-50 transition-transform group-hover:-translate-x-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </span>
            </Link>
          )}
        </div>

        <Reveal y={36}>
          <Link
            href={`/products/${product.slug}`}
            className="group relative mx-auto block overflow-hidden rounded-[2rem] bg-sea-900 md:w-fit"
          >
            {/* The photo is shown WHOLE, at whatever proportions it was uploaded
                with - no fixed aspect box and no object-cover, both of which crop.
                On a phone it spans the width and sets its own height; on a monitor
                its height is capped so a tall portrait shot cannot swallow the
                screen, and the card shrinks to hug it so nothing is letterboxed.
                A plain <img> because the image optimizer is off (see next.config). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.nameFa}
              className="block h-auto w-full max-w-full transition-[filter] duration-500 group-hover:brightness-105 md:max-h-[80vh] md:w-auto"
            />

            {/* The ribbon down the right edge. The text is laid out normally and
                then the whole run is rotated - `writing-mode: vertical-rl` stacks
                Persian letters in a way that is barely readable, while rotating a
                normal horizontal run keeps the shaping and the joins intact. */}
            <div className="absolute inset-y-0 right-0 z-20 flex w-11 items-center justify-center overflow-hidden bg-clay-500/95 shadow-xl md:w-14">
              <span className="rotate-90 whitespace-nowrap font-display text-lg font-black tracking-[0.25em] text-sand-50 md:text-2xl">
                نسخه محدود
              </span>
            </div>

            {/* readable footing for the caption, whatever the photo is */}
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/90 via-sea-900/25 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 pr-16 md:p-8 md:pr-20">
              <div className="min-w-0">
                {product.categoryName && (
                  <span className="chip bg-sand-50/15 text-sand-100 backdrop-blur">
                    {product.categoryName}
                  </span>
                )}
                <h3 className="mt-3 font-display text-2xl font-black leading-tight text-sand-50 md:text-4xl">
                  {product.nameFa}
                </h3>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-xl font-extrabold text-sand-50 md:text-2xl">
                    {toman(final)}
                  </span>
                  {onSale && (
                    <>
                      <span className="text-base text-sand-200/60 line-through">
                        {faNum(product.price)}
                      </span>
                      <span className="chip bg-clay-500 text-sand-50">
                        ٪{faNum(discountPct(product.price, final))} تخفیف
                      </span>
                    </>
                  )}
                </div>
              </div>

              <span className="btn btn-light shrink-0">دیدن محصول</span>
            </div>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
