import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getLeafCategories } from "@/lib/categories";
import { getSizePresets } from "@/lib/sizes";
import { getColorPresets } from "@/lib/variants";
import ProductForm from "@/components/admin/ProductForm";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = (await searchParams) ?? {};
  const [product, categories, presets, colorPresets] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        gallery: { orderBy: { sort: "asc" } },
        sizes: { orderBy: { sort: "asc" } },
        colors: { orderBy: { sort: "asc" } },
      },
    }),
    getLeafCategories(),
    getSizePresets(),
    getColorPresets(),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold text-sea-900">ویرایش محصول</h1>
      {error && (
        <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error === "slug"
            ? "محصول دیگری با همین اسلاگ وجود دارد؛ چیزی ذخیره نشد. اسلاگ باید یکتا باشد."
            : "ذخیره نشد — نام، اسلاگ، دسته‌بندی و قیمت هر چهار لازم‌اند و قیمت باید بزرگ‌تر از صفر باشد."}
        </p>
      )}
      <ProductForm product={product} categories={categories} presets={presets} colorPresets={colorPresets} />
    </div>
  );
}
