import BannerForm from "@/components/admin/BannerForm";

export default function NewBannerPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold text-sea-900">بنر جدید</h1>
      <BannerForm />
    </div>
  );
}
