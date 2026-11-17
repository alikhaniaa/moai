import Link from "next/link";
import Image from "next/image";
import Marquee from "./Marquee";
import type { Settings } from "@/lib/settings";
import EnamadBadge from "./EnamadBadge";

const SHOP_LINKS = [
  { href: "/products?cat=beach-mat", label: "زیرانداز ساحلی" },
  { href: "/products?cat=poncho", label: "پانچو" },
  { href: "/products?cat=bathrobe", label: "حوله تن‌پوش" },
  { href: "/products?cat=body", label: "حوله بدن و استخری" },
  { href: "/products?cat=hand", label: "حوله دستی" },
];

const QUICK_LINKS = [
  { href: "/about", label: "قصه موآی" },
  { href: "/size-guide", label: "راهنمای سایز" },
  { href: "/club", label: "باشگاه مشتریان" },
  { href: "/track", label: "پیگیری سفارش" },
  { href: "/contact", label: "تماس با ما" },
  { href: "/faq", label: "سوالات متداول" },
  { href: "/terms", label: "قوانین و مقررات" },
  { href: "/privacy", label: "حریم خصوصی" },
  { href: "/returns", label: "شرایط بازگشت کالا" },
];

export default function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="relative overflow-hidden bg-sea-900 text-sand-100">
      {/* scrolling brand strip */}
      <div className="border-b border-white/10 py-5">
        <Marquee
          slow
          items={[
            "زیرانداز ساحلی",
            "حوله پینترستی",
            "پانچو کلاه‌دار",
            "الیاف طبیعی پنبه",
            "دست‌دوز تهران",
            "ارسال به سراسر ایران",
          ]}
          className="font-display text-2xl text-sand-200/80"
        />
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-5">
          {/* light variant: the footer is sea-900 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/moai-logo-light.png"
            alt="موآی گالری"
            width={595}
            height={300}
            loading="lazy"
            className="h-16 w-auto"
          />
          <p className="mt-5 max-w-sm text-sm leading-8 text-sand-200/80">
            موآی گالری جایی‌ست برای کسانی که به استایل، کیفیت و حس خوبِ سفر اهمیت
            می‌دهند. همه‌ی محصولات، دست‌دوزِ کارگاه خودمان در تهران‌اند — از جنس
            الیاف طبیعی پنبه.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a
              href={`https://instagram.com/${settings.shopInstagram}`}
              target="_blank"
              rel="noopener"
              aria-label="اینستاگرام"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/15 transition-colors hover:border-clay-300 hover:text-clay-300"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="https://wa.me/989121230000"
              target="_blank"
              rel="noopener"
              aria-label="واتس‌اپ"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/15 transition-colors hover:border-clay-300 hover:text-clay-300"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.2 2.1-.6 3.5a12 12 0 0 0 4.6 4.9c1.7 1 2.6 1 3.5.8.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.2-.2-.3-.4-.4Z" />
              </svg>
            </a>
            <a href={`tel:${settings.shopPhone}`} className="text-sm font-bold tracking-wider text-sand-200" dir="ltr">
              {settings.shopPhone}
            </a>
          </div>
        </div>

        <div className="md:col-span-2">
          <h3 className="mb-5 text-sm font-bold text-clay-300">فروشگاه</h3>
          <ul className="space-y-3 text-sm text-sand-200/80">
            {SHOP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-sand-50">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="mb-5 text-sm font-bold text-clay-300">دسترسی سریع</h3>
          <ul className="space-y-3 text-sm text-sand-200/80">
            {QUICK_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-sand-50">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h3 className="mb-5 text-sm font-bold text-clay-300">اطلاعات تماس</h3>
          <ul className="space-y-3 text-sm leading-7 text-sand-200/80">
            <li>{settings.shopAddress}</li>
            <li dir="ltr" className="text-right">{settings.shopPhone}</li>
            <li>پاسخگویی در واتس‌اپ، همه‌روزه</li>
          </ul>
        </div>
      </div>

      {/* trust & payment marks - a full-width row of their own: the contact
          column is far too narrow to hold three badges on one line */}
      <div className="border-t border-white/10 py-7">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-6 md:px-8">
          <div className="rounded-xl bg-white p-2">
            {/* eNamad trust seal - embedded verbatim; eNamad verifies the
                `code` attribute is present, so this must not be altered */}
            <EnamadBadge />
          </div>
          {/* درگاه پرداخت سپ - the bank our gateway belongs to */}
          <div className="grid place-items-center rounded-xl bg-white p-2">
            <Image
              src="/images/sep.jpg"
              alt="درگاه پرداخت اینترنتی سپ — بانک سامان"
              width={731}
              height={419}
              className="h-auto w-[100px]"
            />
          </div>
          {/* اسنپ‌پی - the instalment option offered at checkout */}
          <div className="grid place-items-center rounded-xl bg-white p-2">
            <Image
              src="/images/snapppay.svg"
              alt="خرید قسطی با اسنپ‌پی"
              width={80}
              height={47}
              className="h-auto w-[100px]"
            />
          </div>
          {/* دیجی‌پی - the third way to pay */}
          <div className="grid place-items-center rounded-xl bg-white p-2">
            <Image
              src="/images/digipay.svg"
              alt="پرداخت با دیجی‌پی"
              width={78}
              height={20}
              className="h-auto w-[100px]"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-6 text-center text-xs text-sand-200/50">
        © {new Date().getFullYear().toLocaleString("fa-IR").replace(/٬/g, "")} موآی گالری — ساخته‌شده با 🧡 در تهران
      </div>
    </footer>
  );
}
