import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { faDate } from "@/lib/format";
import { deleteBanner, toggleBanner } from "../actions";

const SLOT_FA: Record<string, string> = {
  HERO: "بنر بزرگ بالای صفحه",
  STRIP: "نوار بنرها",
  GRID: "شبکه بنرها",
  STORY: "عکس‌های بخش قصه ما",
};

export default async function AdminBanners() {
  const banners = await db.banner.findMany({ orderBy: [{ slot: "asc" }, { sort: "asc" }] });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-sea-900">بنرها</h1>
          <p className="mt-1 text-sm text-ink/68">
            تصویر، متن و لینک بنرهای صفحه اصلی — تغییرات بلافاصله روی سایت اعمال می‌شود.
          </p>
        </div>
        <Link href="/admin/banners/new" className="btn btn-primary">+ بنر جدید</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {banners.map((b) => (
          <div key={b.id} className="card flex gap-4 overflow-hidden p-4">
            <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-sand-100">
              <Image src={b.image} alt="" fill sizes="96px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${b.active ? "bg-sea-100 text-sea-700" : "bg-sand-200 text-ink/68"}`}>
                  {b.active ? "فعال" : "غیرفعال"}
                </span>
                <span className="chip bg-sand-100 text-ink/75">{SLOT_FA[b.slot] ?? b.slot}</span>
                {b.badge && <span className="chip bg-clay-500 text-sand-50">{b.badge}</span>}
              </div>
              <h2 className="mt-2 truncate font-bold text-sea-900">{b.title}</h2>
              {b.subtitle && <p className="truncate text-sm text-ink/75">{b.subtitle}</p>}
              {(b.startsAt || b.endsAt) && (
                <p className="mt-1 text-xs text-ink/60">
                  {b.startsAt ? faDate(b.startsAt) : "…"} تا {b.endsAt ? faDate(b.endsAt) : "…"}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/banners/${b.id}`} className="rounded-full bg-sea-100 px-4 py-1.5 text-xs font-bold text-sea-700 hover:bg-sea-200">
                  ویرایش
                </Link>
                <form action={toggleBanner}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="rounded-full bg-sand-200 px-4 py-1.5 text-xs font-bold text-ink/82 hover:bg-sand-300">
                    {b.active ? "غیرفعال کن" : "فعال کن"}
                  </button>
                </form>
                <form action={deleteBanner}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    حذف
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <div className="card p-12 text-center text-ink/60 md:col-span-2">
            هنوز بنری نساخته‌ای.
          </div>
        )}
      </div>
    </div>
  );
}
