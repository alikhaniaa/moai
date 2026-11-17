import Link from "next/link";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import SectionHeading from "@/components/SectionHeading";

/**
 * A 4-up grid of hand-picked products under a heading the shop owner writes - 
 * «محبوب‌ترین» and «نسخه‌ی محدود» are the same section with different lists.
 *
 * It renders nothing at all when its list is empty, so an unused slot simply
 * disappears from the homepage instead of leaving a titled gap.
 */
export default function ProductRow({
  eyebrow,
  title,
  sub,
  products,
  tone,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  products: ProductCardData[];
  tone?: "sand";
}) {
  if (products.length === 0) return null;

  return (
    <section
      className={`${tone === "sand" ? "bg-sand-100/60" : ""} py-24 md:py-32`}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />
          <Link href="/products" className="btn btn-ghost shrink-0">
            مشاهده همه
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {products.slice(0, 8).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
