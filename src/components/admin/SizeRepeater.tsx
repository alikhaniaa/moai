"use client";

import { useState } from "react";
import { toman } from "@/lib/format";

export type SizeRowData = {
  id?: string;
  label: string;
  rangeLabel: string;
  kind: string; // STANDARD | FREE | CUSTOM
  /** what this size adds to the product's base price; may be negative */
  priceDelta: number | "";
  /** optional absolute override, for a size that goes on sale by itself */
  salePrice: number | "";
  stock: number | "";
  lengthCm: number | "";
  fitFrom: number | "";
  fitTo: number | "";
  heightFrom: number | "";
  heightTo: number | "";
  active: boolean;
};

/** A «الگوی سایزبندی» preset, read from the جدول سایزها table. */
export type Preset = {
  key: string;
  nameFa: string;
  rows: {
    label: string;
    rangeLabel: string;
    kind: string;
    fitFrom: number | null;
    fitTo: number | null;
    heightFrom: number | null;
    heightTo: number | null;
    lengthCm: number | null;
  }[];
};

const KINDS = [
  { value: "STANDARD", label: "استاندارد" },
  { value: "FREE", label: "فری‌سایز" },
  { value: "CUSTOM", label: "سفارشی (فروش آنلاین ندارد)" },
];

const blank = (): SizeRowData => ({
  label: "",
  rangeLabel: "",
  kind: "STANDARD",
  priceDelta: 0,
  salePrice: "",
  stock: 0,
  lengthCm: "",
  fitFrom: "",
  fitTo: "",
  heightFrom: "",
  heightTo: "",
  active: true,
});

/**
 * «سایزها و قیمت‌ها» - the product form's size rows.
 *
 * A size no longer carries a whole price: it carries what it ADDS to the price
 * at the top of the form, so raising the base price raises every size at once
 * and the usual case («همه‌ی سایزها یک قیمت») is simply a row of zeros.
 *
 * The whole list is posted as one JSON field so the server can match rows by id
 * and update them in place; a size id is referenced by saved carts and by past
 * orders, so rows must survive an edit rather than be recreated.
 */
export default function SizeRepeater({
  name,
  initial,
  presets,
  basePrice,
}: {
  name: string;
  initial: SizeRowData[];
  presets: Preset[];
  /** the «قیمت» field at the top of the form, live as it is typed */
  basePrice: number;
}) {
  const [rows, setRows] = useState<SizeRowData[]>(initial);

  const patch = (i: number, changes: Partial<SizeRowData>) =>
    setRows((prev) => prev.map((r, at) => (at === i ? { ...r, ...changes } : r)));

  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const to = i + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });

  const applyPreset = (key: string) => {
    const preset = presets.find((p) => p.key === key);
    if (!preset) return;
    // keep the money the admin already typed for rows with the same label
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    setRows(
      preset.rows.map((r) => {
        const old = byLabel.get(r.label);
        return {
          ...blank(),
          ...(old
            ? { id: old.id, priceDelta: old.priceDelta, salePrice: old.salePrice, stock: old.stock }
            : {}),
          label: r.label,
          rangeLabel: r.rangeLabel,
          kind: r.kind,
          fitFrom: r.fitFrom ?? "",
          fitTo: r.fitTo ?? "",
          heightFrom: r.heightFrom ?? "",
          heightTo: r.heightTo ?? "",
          lengthCm: old?.lengthCm ?? (r.lengthCm ?? ""),
          active: true,
        };
      })
    );
  };

  const finalOf = (r: SizeRowData) => Math.max(0, basePrice + (Number(r.priceDelta) || 0));

  const totalStock = rows
    .filter((r) => r.active && r.kind !== "CUSTOM")
    .reduce((s, r) => s + (Number(r.stock) || 0), 0);
  const priced = rows.filter((r) => r.active && r.kind !== "CUSTOM");
  const lowest = priced.length
    ? Math.min(...priced.map((r) => Number(r.salePrice) || finalOf(r)))
    : Infinity;

  return (
    <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-5">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sea-900">سایزها و قیمت‌ها</h3>
          <p className="mt-1 max-w-lg text-xs leading-6 text-ink/68">
            هر سایز فقط می‌گوید چقدر به <b className="text-sea-900">قیمت پایه</b> اضافه
            می‌کند. اگر همه‌ی سایزها یک قیمت دارند، همه را روی <b>۰</b> بگذار. برای
            سایزی که ارزان‌تر است، عدد منفی بنویس.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input !w-auto !py-2 text-sm"
            defaultValue=""
            onChange={(e) => {
              applyPreset(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              الگوی سایزبندی…
            </option>
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.nameFa}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, blank()])}
            className="btn btn-dark !px-5 !py-2.5 text-sm"
          >
            + سایز
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-xl bg-white px-4 py-6 text-center text-sm text-ink/60">
          این محصول سایز ندارد — با قیمت و موجودی خودِ محصول فروخته می‌شود.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="rounded-2xl border border-sand-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_1.4fr_1.3fr_auto]">
                <Field label="عنوان *">
                  <input
                    className="input !py-2.5 text-sm"
                    placeholder="S"
                    value={r.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                  />
                </Field>
                <Field label="محدوده (متنی که کنار عنوان دیده می‌شود)">
                  <input
                    className="input !py-2.5 text-sm"
                    placeholder="۳۸–۴۰"
                    value={r.rangeLabel}
                    onChange={(e) => patch(i, { rangeLabel: e.target.value })}
                  />
                </Field>
                <Field label="نوع">
                  <select
                    className="input !py-2.5 text-sm"
                    value={r.kind}
                    onChange={(e) => patch(i, { kind: e.target.value })}
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end justify-end gap-1.5 pb-1">
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

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="اختلاف با قیمت پایه (تومان)">
                  <input
                    type="number" dir="ltr"
                    className="input !py-2.5 text-sm disabled:bg-sand-100 disabled:text-ink/45"
                    disabled={r.kind === "CUSTOM"}
                    placeholder={r.kind === "CUSTOM" ? "با هماهنگی" : "0"}
                    value={r.kind === "CUSTOM" ? "" : r.priceDelta}
                    onChange={(e) => patch(i, { priceDelta: numOrBlank(e.target.value) })}
                  />
                </Field>
                <Field label="قیمت این سایز">
                  <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-2.5 text-sm font-bold text-sea-900">
                    {r.kind === "CUSTOM" ? (
                      <span className="text-ink/45">با هماهنگی</span>
                    ) : (
                      toman(finalOf(r))
                    )}
                  </div>
                </Field>
                <Field label="قیمت حراج این سایز (عدد نهایی، اختیاری)">
                  <input
                    type="number" dir="ltr"
                    className="input !py-2.5 text-sm disabled:bg-sand-100 disabled:text-ink/45"
                    disabled={r.kind === "CUSTOM"}
                    value={r.kind === "CUSTOM" ? "" : r.salePrice}
                    onChange={(e) => patch(i, { salePrice: numOrBlank(e.target.value) })}
                  />
                </Field>
                <Field label="موجودی">
                  <input
                    type="number" dir="ltr"
                    className="input !py-2.5 text-sm disabled:bg-sand-100 disabled:text-ink/45"
                    disabled={r.kind === "CUSTOM"}
                    value={r.kind === "CUSTOM" ? "" : r.stock}
                    onChange={(e) => patch(i, { stock: numOrBlank(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="طول (سانتی‌متر)">
                  <input
                    type="number" dir="ltr" className="input !py-2.5 text-sm"
                    placeholder="۹۰"
                    value={r.lengthCm}
                    onChange={(e) => patch(i, { lengthCm: numOrBlank(e.target.value) })}
                  />
                </Field>
                <Field label="مناسب سایز از">
                  <input
                    type="number" dir="ltr" className="input !py-2.5 text-sm"
                    placeholder="۳۸"
                    value={r.fitFrom}
                    onChange={(e) => patch(i, { fitFrom: numOrBlank(e.target.value) })}
                  />
                </Field>
                <Field label="تا سایز">
                  <input
                    type="number" dir="ltr" className="input !py-2.5 text-sm"
                    placeholder="۴۰"
                    value={r.fitTo}
                    onChange={(e) => patch(i, { fitTo: numOrBlank(e.target.value) })}
                  />
                </Field>
                <Field label="قد کودک از">
                  <input
                    type="number" dir="ltr" className="input !py-2.5 text-sm"
                    value={r.heightFrom}
                    onChange={(e) => patch(i, { heightFrom: numOrBlank(e.target.value) })}
                  />
                </Field>
                <div className="grid grid-cols-2 items-end gap-3 lg:contents">
                  <Field label="تا قد">
                    <input
                      type="number" dir="ltr" className="input !py-2.5 text-sm"
                      value={r.heightTo}
                      onChange={(e) => patch(i, { heightTo: numOrBlank(e.target.value) })}
                    />
                  </Field>
                  <div className="flex items-end pb-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-sea-900">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-clay-500"
                        checked={r.active}
                        onChange={(e) => patch(i, { active: e.target.checked })}
                      />
                      فعال
                    </label>
                  </div>
                </div>
              </div>

              {r.kind === "CUSTOM" && (
                <p className="mt-3 rounded-xl bg-gold/12 px-3 py-2 text-xs leading-6 text-clay-700">
                  «سایز سفارشی» آنلاین فروخته نمی‌شود، پس قیمت و موجودی ندارد؛ در
                  صفحه‌ی محصول به‌جای دکمه‌ی خرید، دکمه‌ی گفتگو در واتس‌اپ نشان داده
                  می‌شود و قیمت را همان‌جا به مشتری می‌گویی.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <p className="mt-4 text-xs leading-6 text-ink/68">
          مجموع موجودی سایزها: <b className="text-sea-900">{totalStock.toLocaleString("fa-IR")}</b>{" "}
          — همین عدد به‌عنوان موجودی کل محصول ذخیره می‌شود.
          {Number.isFinite(lowest) && (
            <>
              {" "}روی کارت محصول، ارزان‌ترین سایز نمایش داده می‌شود:{" "}
              <b className="text-sea-900">{toman(lowest)}</b>.
            </>
          )}
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
