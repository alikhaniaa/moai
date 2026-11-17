import { saveBanner } from "@/app/admin/actions";
import ImagePicker from "./ImagePicker";

const isoDay = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function BannerForm({
  banner,
}: {
  banner?: {
    id: string; title: string; subtitle: string | null; badge: string | null;
    image: string; link: string | null; slot: string; sort: number; active: boolean;
    startsAt: Date | null; endsAt: Date | null;
  };
}) {
  return (
    <form action={saveBanner} className="card max-w-3xl space-y-5 p-8">
      {banner?.id && <input type="hidden" name="id" value={banner.id} />}

      <p className="rounded-2xl bg-sand-100 px-4 py-3 text-xs leading-6 text-ink/75">
        برای جایگاه «عکس‌های بخش قصه ما» دو ردیف لازم است: ردیفی که «ترتیب» کوچک‌تری
        دارد عکس بزرگ است و ردیف بعدی، عکس کوچکِ گوشه‌ی آن. در این جایگاه «عنوان»
        فقط توضیح تصویر است (برای گوگل و صفحه‌خوان‌ها) و «زیرعنوان» همان دست‌نوشته‌ی
        زیر عکس کوچک — مثل «بافتِ نرمِ پنبه». برچسب و لینک این‌جا نمایش داده نمی‌شوند.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">عنوان *</label>
          <input name="title" defaultValue={banner?.title} required className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">برچسب (مثلاً ٪۲۰ تخفیف)</label>
          <input name="badge" defaultValue={banner?.badge ?? ""} className="input" />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-sea-900">زیرعنوان</label>
        <input name="subtitle" defaultValue={banner?.subtitle ?? ""} className="input" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">جایگاه</label>
          <select name="slot" defaultValue={banner?.slot ?? "STRIP"} className="input">
            <option value="HERO">بنر بزرگ بالای صفحه</option>
            <option value="STRIP">نوار بنرها</option>
            <option value="GRID">شبکه بنرها</option>
            <option value="STORY">عکس‌های بخش «قصه ما»</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">لینک</label>
          <input name="link" defaultValue={banner?.link ?? ""} dir="ltr" placeholder="/products?cat=poncho" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">ترتیب</label>
          <input name="sort" type="number" defaultValue={banner?.sort ?? 0} dir="ltr" className="input" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">شروع نمایش (اختیاری)</label>
          <input name="startsAt" type="date" defaultValue={isoDay(banner?.startsAt ?? null)} dir="ltr" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-sea-900">پایان نمایش (اختیاری)</label>
          <input name="endsAt" type="date" defaultValue={isoDay(banner?.endsAt ?? null)} dir="ltr" className="input" />
        </div>
      </div>

      <ImagePicker name="image" defaultValue={banner?.image} label="تصویر بنر *" />

      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
        <input type="checkbox" name="active" defaultChecked={banner?.active ?? true} className="h-5 w-5 accent-clay-500" />
        نمایش روی سایت
      </label>

      <button className="btn btn-primary">ذخیره بنر</button>
    </form>
  );
}
