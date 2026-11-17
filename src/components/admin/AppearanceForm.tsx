"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { APPEARANCE_DEFAULTS, COLOR_PRESETS, EVENT_PRESETS, appearanceVariables, eventBanner, luminance, validHex, type Appearance } from "@/lib/appearance";
import { saveAppearance, type AppearanceSaveState } from "@/app/admin/appearance/actions";
import EventBar from "@/components/EventBar";

export default function AppearanceForm({ initial }: { initial: Appearance }) {
  const [appearance, setAppearance] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState<AppearanceSaveState, FormData>(saveAppearance, {});
  const change = (values: Partial<Appearance>) => { setAppearance((current) => ({ ...current, ...values })); setDirty(true); };
  const previewEvent = eventBanner(appearance);
  const validColors = [appearance.main, appearance.accent, appearance.background].every(validHex);
  const lightBackground = validHex(appearance.background) && luminance(appearance.background) >= 0.7;
  const canSave = validColors && lightBackground && (!appearance.eventEnabled || appearance.eventPreset !== "custom" || !!appearance.eventText.trim());

  return (
    <form action={(data) => { setDirty(false); action(data); }} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
        <section className="card p-5 md:p-7">
          <h2 className="font-display text-2xl font-bold text-sea-900">رنگ‌های سایت</h2>
          <p className="mt-2 text-xs leading-6 text-ink/65">رنگ دلخواه را انتخاب کنید یا از ترکیب‌های آماده کمک بگیرید. طیف روشن و تیره خودکار هماهنگ می‌شود. پس‌زمینه باید روشن باشد.</p>
          <div className="my-5 flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => <button type="button" key={preset.name} onClick={() => change({ main: preset.main, accent: preset.accent, background: preset.background })} className="flex items-center gap-2 rounded-full border border-sand-200 px-4 py-2 text-xs font-semibold hover:bg-sand-50">
              <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ background: preset.main }} />{preset.name}
            </button>)}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {([
              ["main", "appearanceMain", "رنگ اصلی", "منو، عنوان‌ها و بخش‌های اصلی"],
              ["accent", "appearanceAccent", "رنگ دکمه‌ها و تأکید", "دکمه‌ها و جزئیات رنگی"],
              ["background", "appearanceBackground", "رنگ پس‌زمینه", "یک رنگ روشن برای زمینه سایت"],
            ] as const).map(([key, name, label, note]) => <div key={key}>
              <label htmlFor={name} className="mb-1 block text-sm font-semibold text-sea-900">{label}</label>
              <p className="mb-2 text-[11px] text-ink/60">{note}</p>
              <div className="flex items-center gap-2">
                <input type="color" aria-label={`انتخاب ${label}`} value={validHex(appearance[key]) ? appearance[key] : "#ffffff"} onChange={(e) => change({ [key]: e.target.value })} className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-sand-200 bg-white p-1" />
                <input id={name} name={name} dir="ltr" value={appearance[key]} onChange={(e) => change({ [key]: e.target.value })} maxLength={7} required pattern="#[0-9a-fA-F]{6}" className="input min-w-0 !px-3 !py-2.5 font-mono text-sm" />
              </div>
            </div>)}
          </div>
          {!lightBackground && <p role="alert" className="mt-3 text-sm text-red-700">برای خوانایی نوشته‌ها، یک رنگ روشن‌تر برای پس‌زمینه انتخاب کنید.</p>}
          <button type="button" onClick={() => change({ main: APPEARANCE_DEFAULTS.appearanceMain, accent: APPEARANCE_DEFAULTS.appearanceAccent, background: APPEARANCE_DEFAULTS.appearanceBackground })} className="mt-5 text-xs font-semibold text-clay-700 underline underline-offset-4">بازگرداندن رنگ‌های اصلی موآی</button>
        </section>

        <section className="card space-y-4 p-5 md:p-7">
          <h2 className="font-display text-2xl font-bold text-sea-900">نوار مناسبت</h2>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
            <input type="checkbox" name="eventEnabled" value="1" checked={appearance.eventEnabled} onChange={(e) => change({ eventEnabled: e.target.checked })} className="h-5 w-5 accent-clay-500" />نمایش نوار مناسبت بالای سایت
          </label>
          <p className="text-xs leading-6 text-ink/65">وقتی روشن باشد، جای نوار اعلان معمولی نمایش داده می‌شود. با خاموش کردن آن، اعلان قبلی برمی‌گردد. رنگ نوار مستقل از رنگ‌های سایت است.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="eventPreset" className="mb-1.5 block text-sm font-semibold text-sea-900">مناسبت</label>
              <select id="eventPreset" name="eventPreset" className="input" value={appearance.eventPreset} onChange={(e) => change({ eventPreset: e.target.value, eventText: "" })}>
                {EVENT_PRESETS.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-sea-900">
              <input type="checkbox" name="eventDecorations" value="1" checked={appearance.eventDecorations} onChange={(e) => change({ eventDecorations: e.target.checked })} className="h-5 w-5 accent-clay-500" />تزئین کوچک کنار متن
            </label>
          </div>
          <div>
            <label htmlFor="eventText" className="mb-1.5 block text-sm font-semibold text-sea-900">متن دلخواه نوار</label>
            <textarea id="eventText" name="eventText" rows={2} maxLength={160} value={appearance.eventText} onChange={(e) => change({ eventText: e.target.value })} placeholder={EVENT_PRESETS.find((e) => e.id === appearance.eventPreset)?.text || "متن مناسبت را بنویسید"} className="input resize-y" />
            <p className="mt-1 text-xs text-ink/60">خالی = متن آماده مناسبت؛ برای «مناسبت دلخواه» متن لازم است. حداکثر ۱۶۰ نویسه.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-sand-200" aria-label="پیش‌نمایش ظاهر">
          <div className="bg-white px-5 py-3 text-xs font-semibold text-ink/65">پیش‌نمایش — تغییرات پس از ذخیره روی سایت اعمال می‌شوند</div>
          <div data-appearance-preview style={appearanceVariables(appearance) as CSSProperties}>
            {previewEvent ? <EventBar event={previewEvent} /> : <div className="bg-sea-900 px-4 py-3 text-center text-xs text-sand-100">نوار اعلان معمولی سایت</div>}
            <div className="bg-sand-50 p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-sand-200 pb-4 text-sea-900"><span className="font-display text-2xl font-black">موآی</span><span className="text-xs">خانه · فروشگاه · تماس</span></div>
              <p className="mt-6 font-display text-3xl font-bold text-sea-900">رنگ تازه، همان حس خوب موآی</p>
              <p className="mt-2 text-sm leading-7 text-ink/70">نمایش نمونه رنگ عنوان‌ها، دکمه‌ها و پس‌زمینه سایت.</p>
              <div className="mt-5 flex flex-wrap gap-3"><span className="btn btn-primary">مشاهده محصولات</span><span className="btn btn-dark">باشگاه موآی</span></div>
            </div>
          </div>
        </section>
      </fieldset>

      <div aria-live="polite">
        {!dirty && state.error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-700">{state.error}</p>}
        {!dirty && state.saved && <p className="mb-4 rounded-2xl bg-sea-100 px-5 py-3 text-sm font-semibold text-sea-700">✓ تغییرات ذخیره شد و روی سایت اعمال شده است.</p>}
        {dirty && <p className="mb-3 text-xs text-ink/65">تغییرات هنوز ذخیره نشده‌اند.</p>}
      </div>
      <button disabled={pending || !canSave} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50">{pending ? "در حال ذخیره…" : "ذخیره ظاهر سایت"}</button>
    </form>
  );
}
