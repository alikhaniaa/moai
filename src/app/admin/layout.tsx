import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { snapppayEnabled, snapppayTestMode, snapppayStagingBase } from "@/lib/snapppay-api";

export const dynamic = "force-dynamic";
export const metadata = { title: "پنل مدیریت" };

const NAV = [
  { href: "/admin", label: "داشبورد", icon: "📊" },
  { href: "/admin/homepage", label: "صفحه اصلی", icon: "🏠" },
  { href: "/admin/products", label: "محصولات", icon: "🧺" },
  { href: "/admin/sizes", label: "جدول سایزها", icon: "📏" },
  { href: "/admin/colors", label: "جدول رنگ‌ها", icon: "🎨" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "🗂️" },
  { href: "/admin/campaigns", label: "تخفیف‌ها", icon: "🏷️" },
  { href: "/admin/coupons", label: "کد تخفیف", icon: "🎟️" },
  { href: "/admin/banners", label: "بنرها", icon: "🖼️" },
  { href: "/admin/orders", label: "سفارش‌ها", icon: "📦" },
  { href: "/admin/shipping", label: "روش ارسال", icon: "🚚" },
  { href: "/admin/transactions", label: "تراکنش‌ها", icon: "💳" },
  { href: "/admin/visits", label: "بازدید", icon: "👀" },
  { href: "/admin/users", label: "کاربران", icon: "👥" },
  { href: "/admin/club", label: "باشگاه", icon: "🐚" },
  { href: "/admin/settings", label: "تنظیمات", icon: "⚙️" },
  { href: "/admin/appearance", label: "ظاهر و مناسبت‌ها", icon: "🍂" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin");

  return (
    <div className="flex min-h-svh bg-sand-100">
      <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col bg-sea-900 text-sand-100 max-md:w-16">
        <div className="shrink-0 border-b border-white/10 p-5 max-md:p-3">
          <Link href="/admin" className="block">
            <span className="font-display text-3xl font-black text-sand-50 max-md:text-xl">موآی</span>
            <span className="mt-1 block text-[10px] tracking-widest text-clay-300 max-md:hidden">
              ADMIN PANEL
            </span>
          </Link>
        </div>
        {/* `min-h-0` is what lets this shrink below its content inside the
            flex column - without it the list grows past the screen and pushes
            «مشاهده سایت» out of view, on a phone AND on a big monitor. */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-sand-100/80 transition-colors hover:bg-white/10 hover:text-sand-50 max-md:justify-center max-md:px-2"
            >
              <span>{n.icon}</span>
              <span className="max-md:hidden">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-sand-100/70 hover:bg-white/10 max-md:justify-center max-md:px-2"
          >
            <span>🌊</span>
            <span className="max-md:hidden">مشاهده سایت</span>
          </Link>
          <div className="px-4 py-2 text-xs text-sand-100/50 max-md:hidden">
            {admin.name ?? admin.phone}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-10">
        {/* اسنپ‌پی is only ever «on» during certification - a staging gateway
            that cannot take real money. The admin driving the test needs to
            see it is on, and to remember to switch it off afterwards. */}
        {snapppayEnabled() && snapppayTestMode() && (
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 border-[#007DFA]/40 bg-[#007DFA]/8 px-5 py-3 text-sm">
            <span className="font-bold text-[#0062c4]">🧪 اسنپ‌پی در حالت تست</span>
            <span className="text-ink/75">
              {snapppayStagingBase()
                ? "درگاه به محیط استیجینگ وصل است و فقط برای شماره‌های تست دیده می‌شود؛ پول واقعی جابه‌جا نمی‌شود."
                : "درگاه فقط برای شماره‌های تست دیده می‌شود."}{" "}
              بعد از پایان آزمایش، در فایل <code className="rounded bg-white/70 px-1">.env</code> مقدار{" "}
              <code className="rounded bg-white/70 px-1">SNAPPPAY_ENABLED</code> را دوباره صفر کن.
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
