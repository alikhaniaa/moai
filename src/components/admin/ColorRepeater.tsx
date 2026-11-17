"use client";

import { useState } from "react";
import { toman } from "@/lib/format";
import { safeHex } from "@/lib/variants";

export type ColorRowData = {
  id?: string;
  nameFa: string;
  hex: string;
  /** what this colour adds to the product's base price; may be negative */
  priceDelta: number | "";
  /** which product photo shows this colourway; "" = none picked yet */
  image: string;
  active: boolean;
};

/** One entry of the global palette, offered by the «از جدول رنگ‌ها» picker. */
export type ColorPresetData = { id: string; nameFa: string; hex: string };

const blank = (): ColorRowData => ({ nameFa: "", hex: "#cccccc", priceDelta: 0, image: "", active: true });

/**
 * «رنگ‌بندی» - the product form's colour rows.
 *
 * Colours work exactly like sizes: each one says what it ADDS to the base
 * price, so «قرمز ‎+۲۰۰٬۰۰۰» is all the shop has to think about. They carry no
 * stock of their own - stock stays on the size rows so there is one shelf to
 * decrement - and a colourway that has run out is simply switched off.
 *
 * The switch at the top is stored on the product, so colours can be retired for
 * a season and brought back later without retyping their prices.
 */
export default function ColorRepeater({
  name,
  enabledName,
  initial,
  initialEnabled,
  presets,
  basePrice,
  images,
}: {
  name: string;
  enabledName: string;
  initial: ColorRowData[];
  initialEnabled: boolean;
  presets: ColorPresetData[];
  basePrice: number;
  /** the product's photos, live from the gallery below */
  images: string[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rows, setRows] = useState<ColorRowData[]>(initial);

  const patch = (i: number, changes: Partial<ColorRowData>) =>
    setRows((prev) => prev.map((r, at) => (at === i ? { ...r, ...changes } : r)));

  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const to = i + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });

  const addPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    // adding the same colour twice would give the buyer two identical chips
    if (rows.some((r) => r.nameFa.trim() === p.nameFa.trim())) return;
    setRows((prev) => [...prev, { ...blank(), nameFa: p.nameFa, hex: p.hex }]);
  };

  const turnOn = () => {
    setEnabled(true);
    if (rows.length === 0) setRows([blank()]);
  };

  const finalOf = (r: ColorRowData) => Math.max(0, basePrice + (Number(r.priceDelta) || 0));
  const live = rows.filter((r) => r.active && r.nameFa.trim());

  return (
    <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-5">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <input type="hidden" name={enabledName} value={enabled ? "1" : "0"} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sea-900">رنگ‌بندی</h3>
          <p className="mt-1 max-w-lg text-xs leading-6 text-ink/68">
            همه‌ی محصول‌ها رنگ‌بندی ندارند. اگر این محصول دارد، روشنش کن و رنگ‌ها را
            بنویس؛ هر رنگ مثل سایز فقط می‌گوید چقدر به{" "}
            <b className="text-sea-900">قیمت پایه</b> اضافه می‌شود.
          </p>
        </div>

        {enabled ? (
          <div className="flex items-center gap-2">
            {presets.length > 0 && (
              <select
                className="input !w-auto !py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  addPreset(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  از جدول رنگ‌ها…
                </option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameFa}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, blank()])}
              className="btn btn-dark !px-5 !py-2.5 text-sm"
            >
              + رنگ
            </button>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              className="btn btn-ghost !px-4 !py-2.5 text-sm"
            >
              خاموش کردن
            </button>
          </div>
        ) : (
          <button type="button" onClick={turnOn} className="btn btn-primary !px-5 !py-2.5 text-sm">
            🎨 فعال‌سازی رنگ‌بندی
          </button>
        )}
      </div>

      {!enabled ? (
        <p className="mt-5 rounded-xl bg-white px-4 py-6 text-center text-sm text-ink/60">
          رنگ‌بندی این محصول خاموش است — در صفحه‌ی محصول هیچ انتخاب رنگی نشان داده
          نمی‌شود.
          {rows.length > 0 && (
            <>
              {" "}
              <b className="text-sea-900">{rows.length.toLocaleString("fa-IR")}</b> رنگِ
              ذخیره‌شده حفظ می‌شود تا هر وقت خواستی دوباره روشنش کنی.
            </>
          )}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-5 rounded-xl bg-white px-4 py-6 text-center text-sm text-ink/60">
          هنوز رنگی اضافه نکرده‌ای.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="rounded-2xl border border-sand-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[auto_1.4fr_1fr_1.1fr_auto]">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink/68">رنگ</label>
                  <input
                    type="color"
                    value={safeHex(r.hex)}
                    onChange={(e) => patch(i, { hex: e.target.value })}
                    aria-label="انتخاب رنگ"
                    className="h-11 w-14 cursor-pointer rounded-xl border border-sand-200 bg-white p-1"
                  />
                </div>
                <Field label="نام رنگ *">
                  <input
                    className="input !py-2.5 text-sm"
                    placeholder="آبی اقیانوسی"
                    value={r.nameFa}
                    onChange={(e) => patch(i, { nameFa: e.target.value })}
                  />
                </Field>
                <Field label="اختلاف با قیمت پایه">
                  <input
                    type="number" dir="ltr" className="input !py-2.5 text-sm"
                    placeholder="0"
                    value={r.priceDelta}
                    onChange={(e) => patch(i, { priceDelta: numOrBlank(e.target.value) })}
                  />
                </Field>
                <Field label="قیمت این رنگ">
                  <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-2.5 text-sm font-bold text-sea-900">
                    {toman(finalOf(r))}
                  </div>
                </Field>
                <div className="flex items-end justify-end gap-1.5 pb-1">
                  <label
                    title="فعال"
                    className="ml-1 flex cursor-pointer items-center gap-1.5 pb-2.5 text-xs font-semibold text-sea-900"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-clay-500"
                      checked={r.active}
                      onChange={(e) => patch(i, { active: e.target.checked })}
                    />
                    فعال
                  </label>
                  <Icon onClick={() => move(i, -1)} title="بالا">↑</Icon>
                  <Icon onClick={() => move(i, 1)} title="پایین">↓</Icon>
                  <Icon
                    onClick={() => setRows((prev) => prev.filter((_, at) => at !== i))}
                    title="حذف"
                    danger
                  >
                    ✕
                  </Icon>
                </div>
              </div>
              {/* which photo this colourway is */}
              <div className="mt-3 border-t border-sand-100 pt-3">
                <label className="mb-2 block text-[11px] font-semibold text-ink/68">
                  عکس این رنگ — وقتی مشتری این رنگ را بزند، گالری به همین عکس می‌رود
                </label>

                {images.length === 0 ? (
                  <p className="rounded-xl bg-sand-100 px-3 py-2.5 text-xs leading-6 text-ink/60">
                    اول از بخش «عکس‌های محصول» پایین، عکس‌ها را اضافه کن تا بتوانی به هر
                    رنگ یکی را بدهی.
                  </p>
                ) : (
                  <div dir="ltr" className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => patch(i, { image: "" })}
                      className={`grid h-16 w-14 place-items-center rounded-xl border-2 text-[10px] font-bold transition-all ${
                        !r.image
                          ? "border-clay-500 bg-clay-500/8 text-clay-700"
                          : "border-sand-200 bg-white text-ink/45 hover:border-sand-300"
                      }`}
                    >
                      بدون عکس
                    </button>
                    {images.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => patch(i, { image: src })}
                        aria-label="انتخاب این عکس"
                        aria-pressed={r.image === src}
                        className={`relative h-16 w-14 overflow-hidden rounded-xl border-2 transition-all ${
                          r.image === src
                            ? "border-clay-500 ring-2 ring-clay-500/25"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {r.image === src && (
                          <span className="absolute inset-x-0 bottom-0 bg-clay-500 py-0.5 text-center text-[9px] font-bold text-sand-50">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {enabled && live.length > 0 && (
        <p className="mt-4 text-xs leading-6 text-ink/68">
          مشتری باید یکی از{" "}
          <b className="text-sea-900">{live.length.toLocaleString("fa-IR")}</b> رنگ فعال را
          انتخاب کند
          {live.length === 1 && " (چون فقط یک رنگ فعال است، خودکار انتخاب می‌شود)"}. رنگ
          موجودی جدا ندارد — موجودی روی سایزها می‌ماند؛ رنگی که تمام شده را
          «فعال» را بردار.
        </p>
      )}
    </div>
  );
}

const numOrBlank = (v: string): number | "" => (v === "" ? "" : Number(v));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-ink/68">{label}</label>
      {children}
    </div>
  );
}

function Icon({
  children, onClick, title, danger,
}: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold transition-colors ${
        danger
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-sand-100 text-sea-800 hover:bg-sand-200"
      }`}
    >
      {children}
    </button>
  );
}
