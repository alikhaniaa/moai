"use client";

import { useActionState, useState } from "react";
import { HERO_DEFAULTS, HERO_TEXT_FIELDS, HERO_DESTINATIONS, type HeroContent, type HeroSaveState } from "@/lib/hero";
import { saveHeroText } from "@/app/admin/homepage/hero-actions";

export default function HeroTextForm({ initial }: { initial: HeroContent }) {
  const [content, setContent] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState<HeroSaveState, FormData>(saveHeroText, {});
  const change = (values: Partial<HeroContent>) => { setContent(c => ({ ...c, ...values })); setDirty(true); };
  return (
    <form action={data => { setDirty(false); action(data); }} className="card space-y-5 p-5 md:p-7" data-hero-text-form>
      <h2 className="font-display text-2xl font-bold text-sea-900">متن و دکمه بالای صفحه</h2>
      <p className="text-xs leading-6 text-ink/65">فقط متن‌ها و مقصد دکمه تغییر می‌کنند؛ چیدمان و انیمیشن‌ها ثابت می‌مانند. پیش‌نمایش تا قبل از ذخیره روی سایت اعمال نمی‌شود.</p>
      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
        {HERO_TEXT_FIELDS.map(field => <div key={field.key}>
          <label htmlFor={field.key} className="mb-1.5 block text-sm font-semibold text-sea-900">{field.label}</label>
          <input id={field.key} name={field.key} value={content[field.key]} required maxLength={field.max} className="input" onChange={e => change({ [field.key]: e.target.value })} />
        </div>)}
        <div>
          <label htmlFor="landingButtonHref" className="mb-1.5 block text-sm font-semibold text-sea-900">مقصد دکمه اصلی</label>
          <select id="landingButtonHref" name="landingButtonHref" value={content.landingButtonHref} onChange={e => change({ landingButtonHref: e.target.value })} className="input">
            {HERO_DESTINATIONS.map(d => <option key={d.href} value={d.href}>{d.label}</option>)}
          </select>
        </div>
      </fieldset>
      <div className="overflow-hidden rounded-2xl bg-sea-900 p-6 text-sand-50" data-hero-text-preview>
        <p className="mb-3 text-xs text-sand-100/65">پیش‌نمایش متن</p>
        <div className="break-words font-display text-4xl font-black leading-tight [overflow-wrap:anywhere]">
          {content.landingTitleFirst}<br /><span className="text-clay-300">{content.landingTitleAccent}</span> {content.landingTitleLast}
        </div>
        <span className="btn btn-primary mt-5 max-w-full break-words text-sm" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{content.landingButtonText}</span>
      </div>
      {!dirty && state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {!dirty && state.saved && <p role="status" className="text-sm font-bold text-sea-700">✓ متن و دکمه ذخیره شد.</p>}
      <div className="flex flex-wrap gap-4">
        <button disabled={pending} className="btn btn-primary">{pending ? "در حال ذخیره…" : "ذخیره متن و دکمه"}</button>
        <button type="button" disabled={pending} onClick={() => change({ ...HERO_DEFAULTS, landingImage: content.landingImage })} className="text-xs font-semibold text-clay-700 underline">بازگرداندن متن اصلی</button>
      </div>
    </form>
  );
}
