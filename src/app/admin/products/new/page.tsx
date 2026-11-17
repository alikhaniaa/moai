import { getLeafCategories } from "@/lib/categories";
import { getSizePresets } from "@/lib/sizes";
import { getColorPresets } from "@/lib/variants";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { error } = (await searchParams) ?? {};
  const [categories, presets, colorPresets] = await Promise.all([
    getLeafCategories(),
    getSizePresets(),
    getColorPresets(),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold text-sea-900">محصول جدید</h1>
      {error && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error === "slug"
            ? "محصول دیگری با همین اسلاگ وجود دارد؛ چیزی ذخیره نشد. اسلاگ باید یکتا باشد."
            : "ذخیره نشد — نام، اسلاگ، دسته‌بندی و قیمت هر چهار لازم‌اند و قیمت باید بزرگ‌تر از صفر باشد."}
        </p>
      )}
      <ProductForm categories={categories} presets={presets} colorPresets={colorPresets} />
    </div>
  );
}
