"use client";

import { useActionState, useRef, useState } from "react";
import { HERO_DEFAULTS, heroImageSrc, type HeroContent, type HeroSaveState } from "@/lib/hero";
import { saveHeroImage } from "@/app/admin/homepage/hero-actions";

export default function HeroImageForm({ initial }: { initial: HeroContent }) {
  const [image, setImage] = useState(initial.landingImage);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState<HeroSaveState, FormData>(saveHeroImage, {});
  const input = useRef<HTMLInputElement>(null);
  const choose = (value: string) => { setImage(value); setDirty(true); setError(""); };
  const upload = async (file: File) => {
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("عکس JPG، PNG یا WEBP با حجم حداکثر ۸ مگابایت انتخاب کن."); return;
    }
    setUploading(true);
    try {
      const data = new FormData(); data.set("file", file); data.set("purpose", "hero");
      const response = await fetch("/api/admin/upload", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "آپلود انجام نشد.");
      choose(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "آپلود انجام نشد."); }
    finally { setUploading(false); }
  };
  return (
    <form action={data => { setDirty(false); action(data); }} className="card space-y-5 p-5 md:p-7" data-hero-image-form>
      <h2 className="font-display text-2xl font-bold text-sea-900">تصویر اول صفحه اصلی</h2>
      <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm leading-7 text-clay-800">
        هشدار: تغییر این تصویر ممکن است ظاهر صفحه را به‌هم بریزد یا خوانایی نوشته‌ها را کم کند، به‌ویژه در موبایل. ترجیحاً فقط با اجازه و هماهنگی توسعه‌دهنده تغییرش بده. قبل از ذخیره، هر دو پیش‌نمایش را بررسی کن.
      </p>
      <p className="text-xs leading-6 text-ink/65">عکس افقی JPG، PNG یا WEBP؛ حداکثر ۸ مگابایت، عرض حداقل ۱۲۰۰ و ارتفاع حداقل ۶۰۰ پیکسل. سوژه مهم را نزدیک مرکز قرار بده. آپلود و پیش‌نمایش به‌تنهایی تصویر سایت را تغییر نمی‌دهند.</p>
      <input type="hidden" name="landingImage" value={image} />
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="انتخاب تصویر اول" className="hidden" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file);
      }} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={uploading || pending} onClick={() => input.current?.click()} className="btn btn-ghost">{uploading ? "در حال آپلود…" : "آپلود تصویر جدید"}</button>
        <button type="button" disabled={uploading || pending} onClick={() => choose(HERO_DEFAULTS.landingImage)} className="text-xs font-semibold text-clay-700 underline">بازگرداندن تصویر اصلی</button>
      </div>
      <div className="grid items-start gap-5 sm:grid-cols-[2fr_1fr]" data-hero-image-preview>
        {([['رایانه', 'aspect-video'], ['موبایل', 'aspect-[9/16]']] as const).map(([label, aspect]) => <div key={label}>
          <p className="mb-2 text-xs font-semibold text-sea-900">برش تقریبی در {label}</p>
          <div className={`relative overflow-hidden rounded-2xl bg-sea-900 ${aspect}`}>
            {/* Native img here shows upload failures without Next image processing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageSrc(image)} alt={`پیش‌نمایش تصویر در ${label}`} className="absolute inset-0 h-full w-full object-cover" onError={() => setError("تصویر بارگذاری نشد. عکس اصلی را بازگردان یا دوباره آپلود کن.")} />
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/90 via-sea-900/25 to-sea-900/10" />
            <div className="absolute inset-x-4 bottom-5 break-words font-display text-2xl font-black leading-tight text-sand-50 [overflow-wrap:anywhere]">
              {initial.landingTitleFirst}<br /><span className="text-clay-300">{initial.landingTitleAccent}</span> {initial.landingTitleLast}
            </div>
          </div>
        </div>)}
      </div>
      {(error || (!dirty && state.error)) && <p role="alert" className="text-sm text-red-700">{error || state.error}</p>}
      {!dirty && state.saved && <p role="status" className="text-sm font-bold text-sea-700">✓ تصویر صفحه اصلی ذخیره شد.</p>}
      <button disabled={pending || uploading || !!error} className="btn btn-primary">{pending ? "در حال ذخیره…" : "ذخیره تصویر"}</button>
    </form>
  );
}
