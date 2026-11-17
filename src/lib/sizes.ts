import { db } from "./db";
import type { Preset } from "@/components/admin/SizeRepeater";
import type { SizeOption } from "./sizing";

/**
 * The global size presets («جدول سایزها»), as the product form's
 * «الگوی سایزبندی» dropdown wants them. They live in the database precisely so
 * that renaming a size or moving a body-size range never needs a developer.
 */
export async function getSizePresets(): Promise<Preset[]> {
  const charts = await db.sizeChart.findMany({
    where: { active: true },
    orderBy: { sort: "asc" },
    include: { rows: { where: { active: true }, orderBy: { sort: "asc" } } },
  });

  return charts.map((c) => ({
    key: c.key,
    nameFa: c.nameFa,
    rows: c.rows.map((r) => ({
      label: r.label,
      rangeLabel: r.rangeLabel,
      kind: r.kind,
      fitFrom: r.fitFrom,
      fitTo: r.fitTo,
      heightFrom: r.heightFrom,
      heightTo: r.heightTo,
      lengthCm: r.lengthCm,
    })),
  }));
}

/** Every chart with its rows - what /size-guide and /admin/sizes render. */
export async function getSizeCharts() {
  return db.sizeChart.findMany({
    where: { active: true },
    orderBy: { sort: "asc" },
    include: { rows: { where: { active: true }, orderBy: { sort: "asc" } } },
  });
}

/**
 * A product's sizes as the estimator sees them. `active: false` rows are left
 * out entirely - she switched them off for a reason.
 */
export const toSizeOptions = (
  sizes: {
    id: string; label: string; kind: string; fitFrom: number | null; fitTo: number | null;
    heightFrom: number | null; heightTo: number | null; lengthCm: number | null; active: boolean;
  }[]
): SizeOption[] =>
  sizes
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      label: s.label,
      kind: s.kind,
      fitFrom: s.fitFrom,
      fitTo: s.fitTo,
      heightFrom: s.heightFrom,
      heightTo: s.heightTo,
      lengthCm: s.lengthCm,
    }));

/**
 * Whether the estimator is worth offering on a product page.
 *
 * It answers "does this fit my body, and where will it fall on me", so all it
 * needs is one buyable size carrying a body or height range. That includes a
 * lone فری‌سایز - «۳۶–۵۴» is precisely the claim a buyer wants checked against
 * her own measurements, and the hem sentence is the rest of the answer.
 *
 * A towel, a bag or a hat has dimensions rather than a fit, so it has no range
 * and gets no estimator - which is also what the brief asks for hats.
 */
export const hasEstimator = (sizes: SizeOption[]) =>
  sizes.some((s) => s.kind !== "CUSTOM" && (s.fitTo !== null || s.heightTo !== null));
