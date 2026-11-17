import Link from "next/link";
import { db } from "@/lib/db";
import { faNum } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { saveClubTier, deleteClubTier, saveSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminClub() {
  const [tiers, settings] = await Promise.all([
    db.clubTier.findMany({ orderBy: { minPoints: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">باشگاه مشتریان</h1>
        <p className="mt-1 text-sm text-ink/68">
          سطح‌ها، امتیازها و مزایای باشگاه را این‌جا مدیریت کن. تغییرات بلافاصله
          در صفحه‌ی باشگاه اعمال می‌شود و به سفارش‌های قبلی آسیبی نمی‌زند.
        </p>
      </div>

      {/* club numbers */}
      <form action={saveSettings} className="card space-y-5 p-7">
        <h2 className="font-bold text-sea-900">اعداد باشگاه</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">امتیاز هدیه‌ی عضویت</label>
            <input name="s_clubWelcomePoints" type="number" dir="ltr" defaultValue={settings.clubWelcomePoints} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">امتیاز به ازای هر ۱۰۰ هزار تومان خرید</label>
            <input name="s_clubPointsPer100k" type="number" dir="ltr" defaultValue={settings.clubPointsPer100k} className="input" />
          </div>
        </div>
        <button className="btn btn-dark">ذخیره اعداد</button>
      </form>

      {/* tiers */}
      <div className="space-y-4">
        <h2 className="font-bold text-sea-900">سطح‌های باشگاه</h2>
        {tiers.map((t) => (
          <form key={t.id} action={saveClubTier} className="card space-y-4 p-6">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="key" value={t.key} />
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink/68">نام سطح</label>
                <input name="nameFa" defaultValue={t.nameFa} className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink/68">ایموجی</label>
                <input name="emoji" defaultValue={t.emoji} className="input text-center" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink/68">حداقل امتیاز</label>
                <input name="minPoints" type="number" dir="ltr" defaultValue={t.minPoints} className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink/68">ترتیب</label>
                <input name="sort" type="number" dir="ltr" defaultValue={t.sort} className="input" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink/68">مزایا (هر خط، یک مزیت)</label>
              <textarea name="perks" defaultValue={t.perks} className="input min-h-28 resize-y" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary !py-2.5 text-sm">ذخیره {t.emoji} {t.nameFa}</button>
              <button formAction={deleteClubTier} className="rounded-full bg-red-50 px-5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100">
                حذف سطح
              </button>
            </div>
          </form>
        ))}
      </div>

      {/* new tier */}
      <form action={saveClubTier} className="card space-y-4 border-2 border-dashed border-sand-300 p-6">
        <h3 className="font-bold text-sea-900">افزودن سطح جدید</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink/68">کلید (انگلیسی)</label>
            <input name="key" dir="ltr" placeholder="diamond" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink/68">نام سطح</label>
            <input name="nameFa" placeholder="الماس" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink/68">ایموجی</label>
            <input name="emoji" defaultValue="💎" className="input text-center" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink/68">حداقل امتیاز</label>
            <input name="minPoints" type="number" dir="ltr" defaultValue={3000} className="input" />
          </div>
        </div>
        <textarea name="perks" placeholder="مزایا — هر خط یک مورد" className="input min-h-24 resize-y" />
        <button className="btn btn-dark">افزودن سطح</button>
      </form>

      <p className="text-xs text-ink/60">
        هم‌اکنون {faNum(tiers.length)} سطح تعریف شده است.
        <Link href="/club" className="mr-2 text-clay-600 underline">مشاهده صفحه باشگاه ←</Link>
      </p>
    </div>
  );
}
