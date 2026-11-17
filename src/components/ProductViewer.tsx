"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import ProductGallery from "./ProductGallery";
import ProductBuyBox, {
  type BuyableColor,
  type BuyableSize,
  type PriceTable,
} from "./ProductBuyBox";

/**
 * The two columns of a product page, and the one piece of state they share.
 *
 * The gallery and the buy box are side by side, but picking «آبی» has to move
 * the gallery - so which photo is on show is owned here, above both of them,
 * rather than inside the gallery. Everything below the buy box (description,
 * trust list, the واتس‌اپ note) is server-rendered and passed through as
 * children, so this component never has to know about it.
 */
export default function ProductViewer({
  images,
  product,
  sizes,
  colors,
  prices,
  headline,
  badge,
  whatsapp,
  showEstimator,
  header,
  children,
}: {
  images: string[];
  product: { id: string; slug: string; nameFa: string; image: string; stock: number };
  sizes: BuyableSize[];
  colors: BuyableColor[];
  prices: PriceTable;
  headline: { price: number; final: number };
  badge: string | null;
  whatsapp: string;
  showEstimator: boolean;
  /** category chip + title, above the price */
  header?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [imageIndex, setImageIndex] = useState(0);

  /** A colourway with a photo of its own jumps the gallery to it. */
  const onColorPick = (color: BuyableColor | null) => {
    if (!color?.image) return;
    const at = images.indexOf(color.image);
    if (at >= 0) setImageIndex(at);
  };

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
      <Reveal y={30} className="min-w-0">
        <div className="lg:sticky lg:top-28">
          <ProductGallery
            images={images}
            alt={product.nameFa}
            badge={badge}
            index={imageIndex}
            onIndexChange={setImageIndex}
          />
        </div>
      </Reveal>

      <div className="min-w-0">
        {header}
        <ProductBuyBox
          product={product}
          sizes={sizes}
          colors={colors}
          prices={prices}
          headline={headline}
          whatsapp={whatsapp}
          showEstimator={showEstimator}
          onColorPick={onColorPick}
        />
        {children}
      </div>
    </div>
  );
}
