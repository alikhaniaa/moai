"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { toman, faNum } from "@/lib/format";
import type { SizeOption } from "@/lib/sizing";
import SizeEstimator from "./SizeEstimator";

export type BuyableSize = {
  id: string;
  label: string;
  rangeLabel: string;
  kind: string; // STANDARD | FREE | CUSTOM
  /** Toman this size adds to the base price */
  priceDelta: number;
  stock: number;
  lengthCm: number | null;
  fitFrom: number | null;
  fitTo: number | null;
  heightFrom: number | null;
  heightTo: number | null;
};

export type BuyableColor = {
  id: string;
  nameFa: string;
  hex: string;
  /** Toman this colour adds to the base price */
  priceDelta: number;
  /** the product photo that shows this colourway, when one is assigned */
  image: string | null;
};

/**
 * Every price the buyer can land on, worked out on the server so the browser
 * never does the arithmetic. Keyed by `sizeId|colorId`, with "" standing in for
 * a product that has no sizes / no colours.
 */
export type PriceTable = Record<string, { price: number; final: number }>;

type Product = {
  id: string;
  slug: string;
  nameFa: string;
  image: string;
  stock: number;
};

export const variantKey = (sizeId: string | null, colorId: string | null) =>
  `${sizeId ?? ""}|${colorId ?? ""}`;

/**
 * Price, size, colour and add-to-cart for one product.
 *
 * These cannot be separated once variants exist: the price on the page and the
 * stock warning both belong to the exact combination the buyer has selected,
 * not to the product. The description is passed through as `children` so the
 * page keeps its original order without this component knowing about it.
 */
export default function ProductBuyBox({
  product,
  sizes,
  colors,
  prices,
  headline,
  whatsapp,
  showEstimator,
  onColorPick,
}: {
  product: Product;
  sizes: BuyableSize[];
  colors: BuyableColor[];
  prices: PriceTable;
  /** cheapest buyable combination, worked out on the server */
  headline: { price: number; final: number };
  whatsapp: string;
  showEstimator: boolean;
  /** lets the page move the gallery to the colourway that was picked */
  onColorPick?: (color: BuyableColor | null) => void;
}) {
  const buyable = sizes.filter((s) => s.kind !== "CUSTOM");
  // One option is not a choice, so make it for them - a سایز سفارشی row
  // alongside it is an offer to talk, not a second option to weigh up.
  const [sizeId, setSizeId] = useState<string | null>(
    buyable.length === 1 ? buyable[0].id : null
  );
  const [colorId, setColorId] = useState<string | null>(
    colors.length === 1 ? colors[0].id : null
  );
  const [qty, setQty] = useState(1);
  const [estimatorOpen, setEstimatorOpen] = useState(false);
  const [nudge, setNudge] = useState<"size" | "color" | null>(null);

  const { add, setOpen } = useCart();
  const router = useRouter();

  const selected = sizes.find((s) => s.id === sizeId) ?? null;
  const selectedColor = colors.find((c) => c.id === colorId) ?? null;
  const hasSizes = sizes.length > 0;
  const hasColors = colors.length > 0;
  const custom = selected?.kind === "CUSTOM";

  /** The server's number for a combination, falling back to the headline. */
  const priceFor = (sId: string | null, cId: string | null) =>
    prices[variantKey(sId, cId)] ?? headline;

  // While a choice is still open the page shows the cheapest thing on offer,
  // which is also what the listing card promised.
  const shown = (() => {
    if (custom) return { price: 0, final: 0 };
    const needSize = hasSizes && !selected;
    const needColor = hasColors && !selectedColor;
    if (!needSize && !needColor) return priceFor(sizeId, colorId);

    const sizeIds = needSize ? buyable.map((s) => s.id) : [sizeId];
    const colorIds = needColor ? colors.map((c) => c.id) : [colorId];
    const all = sizeIds.flatMap((s) => colorIds.map((c) => priceFor(s, c)));
    // A product whose only size is سایز سفارشی offers no buyable combination at
    // all, so there is nothing to take a minimum of - the page then shows what
    // the listing card showed, which is the product's own price.
    return all.length ? all.reduce((a, b) => (b.final < a.final ? b : a)) : headline;
  })();

  const stock = selected ? selected.stock : hasSizes ? 0 : product.stock;
  const out = !custom && (hasSizes ? !!selected && stock <= 0 : stock <= 0);

  const options: SizeOption[] = sizes.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    fitFrom: s.fitFrom,
    fitTo: s.fitTo,
    heightFrom: s.heightFrom,
    heightTo: s.heightTo,
    lengthCm: s.lengthCm,
  }));

  const addLine = (thenCheckout: boolean) => {
    if (hasSizes && !selected) {
      setNudge("size");
      return;
    }
    if (hasColors && !selectedColor) {
      setNudge("color");
      return;
    }
    if (custom) return;
    add(
      {
        id: product.id,
        slug: product.slug,
        nameFa: product.nameFa,
        image: product.image,
        unitPrice: priceFor(sizeId, colorId).final,
        sizeId: selected?.id ?? null,
        sizeLabel: selected?.label ?? null,
        colorId: selectedColor?.id ?? null,
        colorName: selectedColor?.nameFa ?? null,
      },
      qty
    );
    if (thenCheckout) {
      setOpen(false);
      router.push("/checkout");
    }
  };

  const waText = encodeURIComponent(
    `سلام! «${product.nameFa}» را با سایز سفارشی می‌خواستم.`
  );

  return (
    <>
      {/* ── price ── */}
      <div className="mt-6 flex items-baseline gap-4">
        {custom ? (
          // a made-to-measure piece has no list price - it depends on the
          // measurements, so quoting one here would be a promise we can't keep
          <span className="price-lg text-sea-900">قیمت با هماهنگی</span>
        ) : (
          <>
            <span className="price-lg text-sea-900">{toman(shown.final)}</span>
            {shown.final < shown.price && (
              <span className="text-lg text-ink/60 line-through">{faNum(shown.price)}</span>
            )}
          </>
        )}
      </div>

      {/* ── colours ── */}
      {hasColors && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-sea-900">رنگ</span>
            {selectedColor && (
              <span className="text-sm text-ink/68">— {selectedColor.nameFa}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {colors.map((c) => {
              const active = c.id === colorId;
              const combo = priceFor(sizeId, c.id);
              const current = priceFor(sizeId, colorId);
              return (
                <button
                  key={c.id}
                  type="button"
                  data-color-option={c.nameFa}
                  onClick={() => {
                    setColorId(c.id);
                    setNudge(null);
                    onColorPick?.(c);
                  }}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-right transition-colors ${
                    active
                      ? "border-clay-500 bg-clay-500/8"
                      : "border-sand-200 bg-white hover:border-sand-300"
                  }`}
                >
                  <span
                    aria-hidden
                    style={{ background: c.hex }}
                    className="h-6 w-6 shrink-0 rounded-full border border-black/12 shadow-inner"
                  />
                  <span>
                    <span className="block text-sm font-bold text-sea-900">{c.nameFa}</span>
                    {/* a colour that costs more (or less) than the one on show
                        must say so on the chip, not surprise the buyer later */}
                    {colorId !== null && combo.final !== current.final && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-clay-600">
                        {toman(combo.final)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {nudge === "color" && (
            <p className="mt-3 text-sm font-semibold text-clay-600">اول رنگ را انتخاب کن.</p>
          )}
        </div>
      )}

      {/* ── sizes ── */}
      {hasSizes && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold text-sea-900">سایز</span>
            <Link
              href="/size-guide"
              className="text-xs font-semibold text-clay-600 underline underline-offset-4 hover:text-clay-700"
            >
              راهنمای سایز
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const isOut = s.kind !== "CUSTOM" && s.stock <= 0;
              const active = s.id === sizeId;
              const combo = priceFor(s.id, colorId);
              const current = priceFor(sizeId, colorId);
              return (
                <button
                  key={s.id}
                  type="button"
                  data-size-option={s.label}
                  data-size-kind={s.kind}
                  data-size-out={isOut ? "1" : "0"}
                  onClick={() => {
                    setSizeId(s.id);
                    setNudge(null);
                    setQty(1);
                  }}
                  className={`rounded-2xl border px-4 py-2.5 text-right transition-colors ${
                    active
                      ? "border-clay-500 bg-clay-500/8"
                      : "border-sand-200 bg-white hover:border-sand-300"
                  } ${isOut ? "opacity-45" : ""}`}
                >
                  <span className="block text-sm font-bold text-sea-900">{s.label}</span>
                  {s.rangeLabel && (
                    <span className="mt-0.5 block text-[11px] text-ink/68">{s.rangeLabel}</span>
                  )}
                  {s.kind !== "CUSTOM" && sizeId !== null && combo.final !== current.final && (
                    <span className="mt-0.5 block text-[11px] font-semibold text-clay-600">
                      {toman(combo.final)}
                    </span>
                  )}
                  {isOut && <span className="mt-0.5 block text-[11px] text-clay-600">ناموجود</span>}
                </button>
              );
            })}
          </div>

          {showEstimator && (
            <button
              type="button"
              onClick={() => setEstimatorOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-sea-100 px-4 py-2.5 text-sm font-bold text-sea-700 transition-colors hover:bg-sea-200"
            >
              📏 سایزم را پیدا کن
            </button>
          )}

          {nudge === "size" && (
            <p className="mt-3 text-sm font-semibold text-clay-600">
              اول سایز را انتخاب کن.
            </p>
          )}
        </div>
      )}

      {/* ── call to action ── */}
      <div className="mt-8">
        {custom ? (
          <div className="rounded-2xl border border-dashed border-sea-300 bg-sea-100/50 p-5">
            <p className="text-sm leading-8 text-sea-800">
              سایز سفارشی با هماهنگی دوخته می‌شود — قد، اندازه‌ها و رنگ دلخواهت را
              در واتس‌اپ بگو تا قیمت و زمان آماده‌سازی را بگوییم.
            </p>
            <a
              href={`https://wa.me/${whatsapp}?text=${waText}`}
              target="_blank"
              rel="noopener"
              className="btn btn-primary mt-4 w-full sm:w-auto"
            >
              سفارش سایز اختصاصی در واتس‌اپ
            </a>
          </div>
        ) : out ? (
          <div className="rounded-2xl bg-sand-100 p-5 text-center font-semibold text-ink/75">
            {selected ? `سایز ${selected.label} فعلاً تمام شده` : "فعلاً تمام شده"} — به‌زودی
            دوباره می‌دوزیم 🧵
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-4 rounded-full border border-sand-200 bg-white px-5 py-3">
                <button
                  onClick={() => setQty((q) => Math.min(q + 1, Math.max(1, stock)))}
                  className="text-xl text-sea-900"
                  aria-label="افزایش"
                >
                  +
                </button>
                <span className="min-w-6 text-center text-lg font-bold">{faNum(qty)}</span>
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="text-xl text-sea-900"
                  aria-label="کاهش"
                >
                  −
                </button>
              </div>
              <button
                onClick={() => addLine(false)}
                className="btn btn-primary flex-1 text-base"
              >
                افزودن به سبد
              </button>
              <button onClick={() => addLine(true)} className="btn btn-dark">
                خرید سریع
              </button>
            </div>

            {stock > 0 && stock <= 5 && (selected || !hasSizes) && (
              <p className="mt-3 text-xs font-semibold text-clay-600">
                فقط {faNum(stock)} عدد{selected ? ` از سایز ${selected.label}` : ""} باقی مانده!
              </p>
            )}
          </>
        )}
      </div>

      {/* ── estimator modal ── */}
      {estimatorOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-sea-900/55 backdrop-blur-sm sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => setEstimatorOpen(false)}
            aria-hidden
          />
          <div className="relative max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-sand-50 p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow !leading-tight">اندازه‌ات را حدس می‌زنیم…</div>
                <h2 className="font-display text-3xl font-bold text-sea-900">سایزم را پیدا کن</h2>
              </div>
              <button
                onClick={() => setEstimatorOpen(false)}
                aria-label="بستن"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sea-900 hover:bg-sea-900/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <SizeEstimator
              sizes={options}
              whatsapp={whatsapp}
              productName={product.nameFa}
              onPick={(id) => {
                setSizeId(id);
                setNudge(null);
                setQty(1);
                setEstimatorOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
