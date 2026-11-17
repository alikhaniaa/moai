import { getSettings } from "@/lib/settings";
import { getAppearance } from "@/lib/appearance";
import AppearanceForm from "@/components/admin/AppearanceForm";

export const dynamic = "force-dynamic";

export default async function AdminAppearance() {
  const appearance = getAppearance(await getSettings());
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">ظاهر و مناسبت‌ها</h1>
        <p className="mt-2 text-sm leading-7 text-ink/68">رنگ‌های سایت و نوار مناسبت را انتخاب کنید؛ پیش‌نمایش را ببینید و سپس ذخیره کنید.</p>
      </div>
      <AppearanceForm initial={appearance} />
    </div>
  );
}
