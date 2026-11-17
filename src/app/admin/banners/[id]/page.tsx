import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BannerForm from "@/components/admin/BannerForm";

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const banner = await db.banner.findUnique({ where: { id } });
  if (!banner) notFound();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold text-sea-900">ویرایش بنر</h1>
      <BannerForm banner={banner} />
    </div>
  );
}
