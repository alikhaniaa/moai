"use client";

import { useState } from "react";

export type ChartRowData = {
  label: string;
  rangeLabel: string;
  extraLabel: string;
  kind: string;
  fitFrom: number | "";
  fitTo: number | "";
  heightFrom: number | "";
  heightTo: number | "";
  lengthCm: number | "";
  active: boolean;
};

const KINDS = [
  { value: "STANDARD", label: "استاندارد" },
  { value: "FREE", label: "فری‌سایز" },
  { value: "CUSTOM", label: "سفارشی" },
];

const blank = (): ChartRowData => ({
  label: "",
  rangeLabel: "",
  extraLabel: "",
  kind: "STANDARD",
  fitFrom: "",
  fitTo: "",
  heightFrom: "",
  heightTo: "",
  lengthCm: "",
  active: true,
});

const numOrBlank = (v: string): number | "" => (v === "" ? "" : Number(v));

/**
 * The rows of one global size chart.
 *
 * The two label columns are what a buyer reads on /size-guide; the number
 * columns are what the estimator actually matches against. They are separate
 * on purpose - «۳۸–۴۰» is written for a person, `38`–`40` for the arithmetic.
 */
export default function SizeChartRepeater({
  name,
  initial,
  col2Label,
  col3Label,
}: {
  name: string;
  initial: ChartRowData[];
  col2Label: string;
  col3Label: string;
}) {
  const [rows, setRows] = useState<ChartRowData[]>(initial);

  const patch = (i: number, changes: Partial<ChartRowData>) =>
    setRows((prev) => prev.map((r, at) => (at === i ? { ...r, ...changes } : r)));

  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const to = i + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="rounded-2xl border border-sand-200 bg-sand-50/70 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_1.2fr_0.9fr_auto]">
              <Cell label="سایز">
                <input
                  className="input !py-2 text-sm"
                  value={r.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
              </Cell>
              <Cell label={col2Label || "ستون دوم"}>
                <input
                  className="input !py-2 text-sm"
                  value={r.rangeLabel}
                  onChange={(e) => patch(i, { rangeLabel: e.target.value })}
                />
              </Cell>
              <Cell label={col3Label || "ستون سوم"}>
                <input
                  className="input !py-2 text-sm"
                  value={r.extraLabel}
                  onChange={(e) => patch(i, { extraLabel: e.target.value })}
                />
              </Cell>
              <Cell label="نوع">
                <select
                  className="input !py-2 text-sm"
                  value={r.kind}
                  onChange={(e) => patch(i, { kind: e.target.value })}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Cell>
              <div className="flex items-end justify-end gap-1.5 pb-0.5">
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

            <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Cell label="سایز از">
                <input type="number" dir="ltr" className="input !py-2 text-sm"
                  value={r.fitFrom} onChange={(e) => patch(i, { fitFrom: numOrBlank(e.target.value) })} />
              </Cell>
              <Cell label="تا سایز">
                <input type="number" dir="ltr" className="input !py-2 text-sm"
                  value={r.fitTo} onChange={(e) => patch(i, { fitTo: numOrBlank(e.target.value) })} />
              </Cell>
              <Cell label="قد از">
                <input type="number" dir="ltr" className="input !py-2 text-sm"
                  value={r.heightFrom} onChange={(e) => patch(i, { heightFrom: numOrBlank(e.target.value) })} />
              </Cell>
              <Cell label="تا قد">
                <input type="number" dir="ltr" className="input !py-2 text-sm"
                  value={r.heightTo} onChange={(e) => patch(i, { heightTo: numOrBlank(e.target.value) })} />
              </Cell>
              <Cell label="طول لباس">
                <input type="number" dir="ltr" className="input !py-2 text-sm"
                  value={r.lengthCm} onChange={(e) => patch(i, { lengthCm: numOrBlank(e.target.value) })} />
              </Cell>
              <div className="flex items-end pb-2">
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
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, blank()])}
        className="btn btn-ghost mt-3 !px-5 !py-2 text-sm"
      >
        + ردیف
      </button>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-ink/60">{label}</label>
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
        danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-sand-100 text-sea-800 hover:bg-sand-200"
      }`}
    >
      {children}
    </button>
  );
}
