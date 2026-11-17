import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getActiveCampaigns, toCard } from "@/lib/pricing";
import { categoryIdsForSlug, getCategoryTree } from "@/lib/categories";
import { getLimitedEditionIds } from "@/lib/home";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata = { title: "فروشگاه" };

const SORTS: Record<string, { label: string; order: object }> = {
  new: { label: "جدیدترین", order: { createdAt: "desc" } },
  cheap: { label: "ارزان‌ترین", order: { price: "asc" } },
  expensive: { label: "گران‌ترین", order: { price: "desc" } },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string; q?: string; limited?: string }>;
}) {
  const { cat, sort = "new", q, limited } = await searchParams;
  const sortDef = SORTS[sort] ?? SORTS.new;
  const query = q?.trim();

  // A parent category shows everything under its children, so the filter is a
  // set of ids rather than one slug - and old ?cat=<leaf-slug> links still work
  // because the leaves kept the slugs they always had.
  const catIds = cat ? await categoryIdsForSlug(cat) : null;

  // «نسخه محدود» is a curated collection rather than a category: a product
  // already belongs to exactly one category (پانچو، حوله…), so making this one
  // too would pull each piece out of the group shoppers actually browse. The
  // list the shop pins in «صفحه اصلی» is the collection.
  const limitedOnly = limited === "1";
  const limitedIds = limitedOnly ? await getLimitedEditionIds() : null;

  const [tree, products, campaigns] = await Promise.all([
    getCategoryTree(),
    db.product.findMany({
      where: {
        active: true,
        ...(catIds ? { categoryId: { in: catIds } } : {}),
        ...(limitedIds ? { id: { in: limitedIds } } : {}),
        ...(query
          ? {
              OR: [
                { nameFa: { contains: query } },
                { description: { contains: query } },
              ],
            }
          : {}),
      },
      include: { category: true, sizes: true, colors: true },
      orderBy: sortDef.order as never,
    }),
    getActiveCampaigns(),
  ]);

  const activeParent =
    tree.find((c) => c.slug === cat) ??
    tree.find((c) => c.children.some((k) => k.slug === cat)) ??
    null;
  const activeCat =
    tree.find((c) => c.slug === cat) ??
    activeParent?.children.find((k) => k.slug === cat) ??
    null;
  const qs = (params: Record<string, string | undefined>) => {
    const merged = { cat, sort, q, limited, ...params };
    const s = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return s ? `?${s}` : "";
  };

  return (
    <>
      {/* header */}
      <section className="relative overflow-hidden bg-sea-900 pb-20 pt-36 text-sand-50">
        <Image
          src="/images/shore.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 md:px-8">
          <div className="eyebrow !text-clay-300">
            {query
              ? "نتیجه‌ی جستجو"
              : limitedOnly
                ? "فقط چند عدد از هرکدام…"
                : "هر چه برای دریا لازم داری…"}
          </div>
          <h1 className="font-display text-5xl font-black md:text-7xl">
            {query
              ? `«${query}»`
              : limitedOnly
                ? "نسخه محدود"
                : activeCat
                  ? activeCat.nameFa
                  : "فروشگاه موآی"}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8">
        {/* filters */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/products${qs({ cat: undefined })}`}
              className={`chip transition-colors ${
                !cat ? "bg-sea-800 text-sand-50" : "bg-sand-100 text-ink/82 hover:bg-sand-200"
              }`}
            >
              همه
            </Link>
            {tree.map((c) => (
              <Link
                key={c.slug}
                href={`/products${qs({ cat: c.slug })}`}
                className={`chip transition-colors ${
                  activeParent?.slug === c.slug
                    ? "bg-sea-800 text-sand-50"
                    : "bg-sand-100 text-ink/82 hover:bg-sand-200"
                }`}
              >
                {c.nameFa}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink/68">مرتب‌سازی:</span>
            {Object.entries(SORTS).map(([key, s]) => (
              <Link
                key={key}
                href={`/products${qs({ sort: key })}`}
                className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
                  sort === key ? "bg-clay-500 text-sand-50" : "text-ink/75 hover:bg-sand-100"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* the chosen group's own sections */}
        {activeParent && activeParent.children.length > 0 && (
          <div className="-mt-4 mb-10 flex flex-wrap gap-2">
            <Link
              href={`/products${qs({ cat: activeParent.slug })}`}
              className={`chip transition-colors ${
                cat === activeParent.slug
                  ? "bg-clay-500 text-sand-50"
                  : "bg-white text-ink/82 ring-1 ring-sand-200 hover:ring-sand-300"
              }`}
            >
              همه‌ی {activeParent.nameFa}
            </Link>
            {activeParent.children.map((k) => (
              <Link
                key={k.slug}
                href={`/products${qs({ cat: k.slug })}`}
                className={`chip transition-colors ${
                  cat === k.slug
                    ? "bg-clay-500 text-sand-50"
                    : "bg-white text-ink/82 ring-1 ring-sand-200 hover:ring-sand-300"
                }`}
              >
                {k.nameFa}
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <p className="py-24 text-center text-ink/68">
            {query ? `برای «${query}» محصولی پیدا نشد.` : "محصولی در این دسته پیدا نشد."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 0.06}>
                <ProductCard p={toCard(p, campaigns)} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
