"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { toman, faNum, discountPct } from "@/lib/format";

export type ProductCardData = {
  id: string;
  slug: string;
  nameFa: string;
  price: number;
  salePrice: number | null;
  image: string;
  categoryName?: string;
  /** How many buyable sizes this product has; >1 means the buyer must choose. */
  sizeCount?: number;
};

export default function ProductCard({ p, tall }: { p: ProductCardData; tall?: boolean }) {
  const { add } = useCart();
  const router = useRouter();
  const final = p.salePrice ?? p.price;
  // adding blind would guess a size for her, so send her to the page instead
  const mustChoose = (p.sizeCount ?? 0) > 1;

  return (
    <div className="group relative">
      <Link href={`/products/${p.slug}`} className="block">
        <div className={`img-frame relative bg-sand-100 ${tall ? "aspect-[3/4]" : "aspect-[4/5]"}`}>
          <Image
            src={p.image}
            alt={p.nameFa}
            fill
            sizes="(max-width: 768px) 90vw, 25vw"
            className="object-cover"
          />
          {p.salePrice && (
            <span className="chip absolute top-3 right-3 bg-clay-500 text-sand-50">
              ٪{faNum(discountPct(p.price, p.salePrice))} تخفیف
            </span>
          )}
          {/* quick add */}
          <button
            onClick={(e) => {
              e.preventDefault();
              if (mustChoose) {
                router.push(`/products/${p.slug}`);
                return;
              }
              add({ id: p.id, slug: p.slug, nameFa: p.nameFa, image: p.image, unitPrice: final });
            }}
            aria-label={mustChoose ? "انتخاب سایز" : "افزودن به سبد"}
            title={mustChoose ? "انتخاب سایز" : "افزودن به سبد"}
            className="absolute bottom-3 left-3 grid h-11 w-11 translate-y-14 place-items-center rounded-full bg-sand-50 text-sea-900 opacity-0 shadow-lg transition-all duration-300 hover:bg-clay-500 hover:text-sand-50 group-hover:translate-y-0 group-hover:opacity-100"
          >
            {mustChoose ? (
              <span className="text-[11px] font-extrabold">سایز</span>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8h12l-1 12H7L6 8Z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                <path d="M12 12v4M10 14h4" />
              </svg>
            )}
          </button>
        </div>
        <div className="mt-4 space-y-1.5 px-1">
          {p.categoryName && (
            <span className="text-[11px] font-semibold tracking-wide text-clay-500">
              {p.categoryName}
            </span>
          )}
          <h3 className="text-sm font-bold leading-7 text-sea-900 transition-colors group-hover:text-clay-600">
            {p.nameFa}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-sea-900">{toman(final)}</span>
            {p.salePrice && (
              <span className="text-xs text-ink/60 line-through">{faNum(p.price)}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
