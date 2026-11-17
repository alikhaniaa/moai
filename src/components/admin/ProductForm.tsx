"use client";

import { useState } from "react";
import { saveProduct } from "@/app/admin/actions";
import GalleryManager from "./GalleryManager";
import SizeRepeater, { type Preset, type SizeRowData } from "./SizeRepeater";
import ColorRepeater, { type ColorPresetData, type ColorRowData } from "./ColorRepeater";

type ProductData = {
  id?: string;
  nameFa?: string;
  slug?: string;
  description?: string;
  price?: number;
  salePrice?: number | null;
  stock?: number;
  image?: string;
  gallery?: { url: string }[];
  featured?: boolean;
  active?: boolean;
  colorsEnabled?: boolean;
  categoryId?: string;
  sizes?: {
    id: string; label: string; rangeLabel: string; kind: string;
    priceDelta: number; salePrice: number | null; stock: number; lengthCm: number | null;
    fitFrom: number | null; fitTo: number | null;
    heightFrom: number | null; heightTo: number | null; active: boolean;
  }[];
  colors?: {
    id: string; nameFa: string; hex: string; priceDelta: number; image: string | null; active: boolean;
  }[];
};

const toSizeRow = (s: NonNullable<ProductData["sizes"]>[number]): SizeRowData => ({
  id: s.id,
  label: s.label,
  rangeLabel: s.rangeLabel,
  kind: s.kind,
  priceDelta: s.priceDelta,
  salePrice: s.salePrice ?? "",
  stock: s.stock,
  lengthCm: s.lengthCm ?? "",
  fitFrom: s.fitFrom ?? "",
  fitTo: s.fitTo ?? "",
  heightFrom: s.heightFrom ?? "",
  heightTo: s.heightTo ?? "",
  active: s.active,
});

const toColorRow = (c: NonNullable<ProductData["colors"]>[number]): ColorRowData => ({
  id: c.id,
  nameFa: c.nameFa,
  hex: c.hex,
  priceDelta: c.priceDelta,
  image: c.image ?? "",
  active: c.active,
});

export default function ProductForm({
  product,
  categories,
  presets,
  colorPresets,
}: {
  product?: ProductData;
  categories: { id: string; nameFa: string }[];
  presets: Preset[];
  colorPresets: ColorPresetData[];
}) {
  // Sizes and colours are priced as differences from this number, so both
  // repeaters need it as it is typed rather than as it was on page load.
  const [basePrice, setBasePrice] = useState(product?.price ?? 0);
  // The colour rows offer these as swatches, so they must track the gallery
  // below as photos are uploaded or removed - before anything is saved.
  const [images, setImages] = useState<string[]>([
    ...(product?.image ? [product.image] : []),
    ...(product?.gallery?.map((g) => g.url) ?? []),
  ]);

  return (
    <form action={saveProduct} className="card max-w-3xl space-y-5 p-8">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">نام محصول *</label>
          <input name="nameFa" defaultValue={product?.nameFa} required className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">اسلاگ (انگلیسی) *</label>
          <input name="slug" defaultValue={product?.slug} required dir="ltr" className="input" placeholder="beach-towel" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">قیمت پایه (تومان) *</label>
          <input
            name="price"
            type="number"
            value={basePrice || ""}
            onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
            required
            dir="ltr"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">قیمت حراج (اختیاری)</label>
          <input name="salePrice" type="number" defaultValue={product?.salePrice ?? ""} dir="ltr" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">موجودی</label>
          <input name="stock" type="number" defaultValue={product?.stock ?? 20} dir="ltr" className="input" />
        </div>
      </div>
      <p className="-mt-2 text-xs leading-6 text-ink/60">
        <b className="text-sea-900">قیمت پایه</b> مبنای همه‌چیز است: قیمت هر سایز و هر
        رنگ از همین عدد به‌علاوه‌ی اختلافی که پایین می‌نویسی حساب می‌شود. «موجودی» فقط
        وقتی استفاده می‌شود که محصول هیچ سایزی نداشته باشد.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">دسته‌بندی *</label>
          <select name="categoryId" defaultValue={product?.categoryId ?? ""} required className="input">
            <option value="" disabled>انتخاب کن…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nameFa}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="featured" defaultChecked={product?.featured} className="h-5 w-5 accent-clay-500" />
            نمایش در ویترین صفحه اصلی
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="h-5 w-5 accent-clay-500" />
            نمایش در فروشگاه
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-sea-900">توضیحات</label>
        <textarea name="description" defaultValue={product?.description} className="input min-h-28 resize-y" />
      </div>

      <SizeRepeater
        name="sizes"
        initial={(product?.sizes ?? []).map(toSizeRow)}
        presets={presets}
        basePrice={basePrice}
      />

      <ColorRepeater
        name="colors"
        enabledName="colorsEnabled"
        initial={(product?.colors ?? []).map(toColorRow)}
        initialEnabled={product?.colorsEnabled ?? false}
        presets={colorPresets}
        basePrice={basePrice}
        images={images}
      />

      <GalleryManager
        name="images"
        initial={images}
        onChange={setImages}
      />

      <button className="btn btn-primary">ذخیره محصول</button>
    </form>
  );
}
