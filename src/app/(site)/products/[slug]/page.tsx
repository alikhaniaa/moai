import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SITE_NAME, SITE_URL, metaDescription, productOgImage } from "@/lib/seo";
import {
  getActiveCampaigns, toCard, priceOfVariant, priceOfListing, liveColors,
  type SizeLike, type ColorLike,
} from "@/lib/pricing";
import { safeHex } from "@/lib/variants";
import { getSettings } from "@/lib/settings";
import { hasEstimator, toSizeOptions } from "@/lib/sizes";
import { faNum, discountPct } from "@/lib/format";
import ProductViewer from "@/components/ProductViewer";
import ProductDescription from "@/components/ProductDescription";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

/** Per-product title, description and share image - without these every product
 *  page looks identical to Google and shares as a bare link. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!product || !product.active) return { title: "محصول پیدا نشد", robots: { index: false, follow: true } };

  const description = metaDescription(
    product.description,
    `${product.nameFa} از ${SITE_NAME} — دست‌دوز، از الیاف طبیعی نخ پنبه.`
  );
  // Not the raw photo: that's portrait WebP, which the messengers either
  // refuse outright or crop to a sliver. /og/<slug> renders a 1200x630 JPEG.
  const image = { ...productOgImage(slug, product.image), alt: product.nameFa };
  const url = `/products/${slug}`;

  return {
    title: product.nameFa,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "fa_IR",
      url,
      title: `${product.nameFa} | ${SITE_NAME}`,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.nameFa} | ${SITE_NAME}`,
      description,
      images: [image.url],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      gallery: { orderBy: { sort: "asc" } },
      sizes: { where: { active: true }, orderBy: { sort: "asc" } },
      colors: { where: { active: true }, orderBy: { sort: "asc" } },
    },
  });
  if (!product || !product.active) notFound();

  const [related, campaigns, settings] = await Promise.all([
    db.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id }, active: true },
      include: { category: true, sizes: true, colors: true },
      take: 4,
    }),
    getActiveCampaigns(),
    getSettings(),
  ]);

  // Every photo of this product, main first - the gallery order, and what a
  // colourway's assigned photo is looked up against.
  const galleryImages = [...new Set([product.image, ...product.gallery.map((g) => g.url)].filter(Boolean))];

  // Colours the buyer may actually pick, per the «رنگ‌بندی» switch.
  const colors = liveColors(product).map((c) => ({
    id: c.id,
    nameFa: c.nameFa,
    hex: safeHex(c.hex),
    priceDelta: c.priceDelta,
    // only a photo the product actually has can be jumped to
    image: c.image && galleryImages.includes(c.image) ? c.image : null,
  }));

  const sizes = product.sizes.map((s) => ({
    id: s.id,
    label: s.label,
    rangeLabel: s.rangeLabel,
    kind: s.kind,
    priceDelta: s.priceDelta,
    stock: s.stock,
    lengthCm: s.lengthCm,
    fitFrom: s.fitFrom,
    fitTo: s.fitTo,
    heightFrom: s.heightFrom,
    heightTo: s.heightTo,
  }));

  // Every price the buyer could land on, worked out here with the real pricing
  // rules - campaigns, sale prices and both surcharges. The browser only ever
  // looks a combination up, so no price is ever computed client-side.
  const offered = liveColors(product);
  const sizeAxis: (SizeLike | null)[] = product.sizes.length ? product.sizes : [null];
  const colorAxis: (ColorLike | null)[] = offered.length ? offered : [null];

  const prices: Record<string, { price: number; final: number }> = {};
  for (const s of sizeAxis) {
    for (const c of colorAxis) {
      const priced = priceOfVariant(product, s, c, campaigns);
      prices[`${s?.id ?? ""}|${c?.id ?? ""}`] = { price: priced.price, final: priced.final };
    }
  }

  // the headline price and the discount badge follow the cheapest thing on offer
  const headline = priceOfListing(product, campaigns);
  const options = toSizeOptions(product.sizes);

  // Structured data, so a Google result carries the photo, price and stock
  // rather than a bare blue link. Prices are stored in Toman; IRR is the only
  // ISO code Google accepts for Iran, hence the ×10.
  const inStock = product.stock > 0 || product.sizes.some((s) => s.stock > 0);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameFa,
    description: metaDescription(product.description, product.nameFa, 300),
    image: galleryImages.map((i) => `${SITE_URL}${i}`),
    sku: product.slug,
    category: product.category.nameFa,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: "IRR",
      price: headline.final * 10,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-28 md:px-8 md:pt-36">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-ink/68">
          <Link href="/" className="hover:text-clay-600">خانه</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-clay-600">فروشگاه</Link>
          <span>/</span>
          <Link href={`/products?cat=${product.category.slug}`} className="hover:text-clay-600">
            {product.category.nameFa}
          </Link>
          <span>/</span>
          <span className="text-ink/80">{product.nameFa}</span>
        </nav>

        <ProductViewer
          images={galleryImages}
          product={{
            id: product.id,
            slug: product.slug,
            nameFa: product.nameFa,
            image: product.image,
            stock: product.stock,
          }}
          sizes={sizes}
          colors={colors}
          prices={prices}
          headline={{ price: headline.price, final: headline.final }}
          badge={
            headline.final < headline.price
              ? `٪${faNum(discountPct(headline.price, headline.final))} تخفیف`
              : null
          }
          whatsapp={settings.shopWhatsapp}
          showEstimator={hasEstimator(options)}
          header={
            <>
              <span className="chip bg-sea-100 text-sea-700">{product.category.nameFa}</span>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.2] text-sea-900 md:text-5xl">
                {product.nameFa}
              </h1>
            </>
          }
        >
          {/* Everything below the buy box. The description used to sit between
              the price and the size chips, which pushed «افزودن به سبد» seven
              screens down on a phone - it belongs after the decision, not in
              the middle of it. */}
          <ProductDescription text={product.description} />

          <ul className="mt-10 grid gap-3 text-sm text-ink/82 sm:grid-cols-2">
            {[
              "۱۰۰٪ الیاف طبیعی نخ پنبه",
              "دست‌دوز کارگاه موآی، تهران",
              "ارسال با تیپاکس به سراسر ایران",
              "کیفیت تضمین‌شده",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5 rounded-2xl bg-sand-100 px-4 py-3">
                <span className="text-clay-500">✦</span>
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-dashed border-sea-300 bg-sea-100/50 p-5 text-sm leading-7 text-sea-800">
            سوالی درباره سایز، رنگ یا سفارشی‌دوزی داری؟{" "}
            <Link href="/size-guide" className="font-bold text-sea-700 underline underline-offset-4">
              راهنمای سایز
            </Link>{" "}
            را ببین یا در واتس‌اپ بپرس:{" "}
            <a
              href={`https://wa.me/${settings.shopWhatsapp}?text=${encodeURIComponent(`سلام! درباره «${product.nameFa}» سوال داشتم.`)}`}
              target="_blank"
              rel="noopener"
              className="font-bold text-sea-700 underline underline-offset-4"
            >
              گفتگو در واتس‌اپ
            </a>
          </div>
        </ProductViewer>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl border-t border-sand-200 px-6 py-20 md:px-8">
          <h2 className="mb-10 font-display text-3xl font-bold text-sea-900 md:text-4xl">
            شاید این‌ها را هم دوست داشته باشی
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {related.map((p) => (
              <ProductCard key={p.id} p={toCard(p, campaigns)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
