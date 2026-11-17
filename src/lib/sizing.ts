/**
 * «سایزم را پیدا کن» - the size estimator's arithmetic.
 *
 * Everything here is a pure function of its arguments: nothing is stored, and
 * nothing touches the database or the browser, so `tools/sizetest.mjs` can
 * exercise it directly. The UI lives in `src/components/SizeEstimator.tsx`.
 *
 * Iranian ready-to-wear sizing steps 4 cm of hip circumference per size,
 * starting at size 36 ≈ 88 cm hip.
 */

export type Who = "female" | "male" | "kid";
export type Fit = "regular" | "loose";

export const SIZE_MIN = 34;
export const SIZE_MAX = 56;

const HIP_AT_36 = 88;
const CM_PER_SIZE = 4;

export const clampSize = (n: number) => Math.min(SIZE_MAX, Math.max(SIZE_MIN, n));

/** kg / m² - the usual definition. */
export function bmi(heightCm: number, weightKg: number) {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}

/**
 * Hip circumference estimated from height and weight, used only when she
 * hasn't measured herself. The offsets recentre the curve on the average
 * Iranian adult height (۱۶۵ خانم / ۱۷۵ آقا).
 */
export function estimateHip(who: Who, heightCm: number, weightKg: number) {
  const b = bmi(heightCm, weightKg);
  return who === "male"
    ? 1.8 * b + 53 + 0.2 * (heightCm - 175)
    : 2.0 * b + 53 + 0.2 * (heightCm - 165);
}

/** Hip circumference → the (fractional) Iranian size number. */
export const sizeFromHip = (hipCm: number) =>
  36 + (hipCm - HIP_AT_36) / CM_PER_SIZE;

/** …and back, for explaining a size in centimetres. */
export const hipFromSize = (size: number) =>
  HIP_AT_36 + (size - 36) * CM_PER_SIZE;

/** Iranian sizes are even numbers, so round to the nearest one. */
export const roundToEvenSize = (n: number) => Math.round(n / 2) * 2;

export type EstimateInput = {
  who: Who;
  heightCm?: number | null;
  weightKg?: number | null;
  hipCm?: number | null;
  bustCm?: number | null;
  /** «سایز لباس معمولی‌ات» - when she knows it, it beats every estimate. */
  usualSize?: number | null;
  fit?: Fit;
};

export type Estimate = {
  size: number;
  /** Where the number came from - drives the "why" line on the result card. */
  basis: "usual" | "hip" | "bmi";
  /** Hip in cm, when we had one or estimated one. */
  hipCm: number | null;
  /** The unrounded size, before rounding and the "looser" bump. */
  raw: number;
  /** True when the raw number sits near-exactly between two sizes. */
  betweenSizes: boolean;
  /** True when "کمی آزادتر" actually moved the answer. */
  loosened: boolean;
};

/**
 * Work out the buyer's Iranian size, best information first:
 *   1. the size she already wears
 *   2. her measured hip
 *   3. a hip estimated from height and weight
 */
export function estimateSize(input: EstimateInput): Estimate | null {
  const fit = input.fit ?? "regular";
  let raw: number;
  let basis: Estimate["basis"];
  let hipCm: number | null = null;

  if (input.usualSize && input.usualSize > 0) {
    raw = input.usualSize;
    basis = "usual";
    hipCm = hipFromSize(input.usualSize);
  } else if (input.hipCm && input.hipCm > 0) {
    hipCm = input.hipCm;
    raw = sizeFromHip(hipCm);
    basis = "hip";
  } else if (input.heightCm && input.weightKg && input.heightCm > 0 && input.weightKg > 0) {
    hipCm = estimateHip(input.who, input.heightCm, input.weightKg);
    raw = sizeFromHip(hipCm);
    basis = "bmi";
  } else {
    return null; // not enough to say anything honest
  }

  const rounded = roundToEvenSize(raw);
  const loose = fit === "loose" ? rounded + 2 : rounded;
  const size = clampSize(loose);

  return {
    size,
    basis,
    hipCm: hipCm === null ? null : Math.round(hipCm),
    raw,
    // half a size step is 1.0; anything from 0.7 up is "between two sizes"
    betweenSizes: basis !== "usual" && Math.abs(raw - rounded) >= 0.7,
    loosened: fit === "loose" && size !== clampSize(rounded),
  };
}

// ── Matching an estimate to what the product actually offers ─────────

export type SizeOption = {
  id: string;
  label: string;
  kind: string; // STANDARD | FREE | CUSTOM
  fitFrom: number | null;
  fitTo: number | null;
  heightFrom: number | null;
  heightTo: number | null;
  lengthCm: number | null;
  active?: boolean;
};

export type Pick = {
  size: SizeOption | null;
  /** exact = a size that covers the number · free = فری‌سایز covers it ·
   *  custom = bigger than everything on offer · smallest = below the range */
  how: "exact" | "free" | "custom" | "smallest" | "none";
  /** The estimate sits at the top of its band - the next size up is roomier. */
  atTopOfRange: boolean;
};

const covers = (s: SizeOption, n: number) =>
  s.fitFrom !== null && s.fitTo !== null && n >= s.fitFrom && n <= s.fitTo;

/**
 * Pick the row the buyer should actually add to the cart.
 *
 * A فری‌سایز that covers the number is a real answer, but only after no
 * standard size does - and a number above everything on offer means the piece
 * has to be made to measure, which is a conversation, not an add-to-cart.
 */
export function pickSize(all: SizeOption[], sizeNumber: number): Pick {
  const sizes = all.filter((s) => s.active !== false);
  const standard = sizes.filter((s) => s.kind === "STANDARD");
  const free = sizes.filter((s) => s.kind === "FREE");
  const custom = sizes.find((s) => s.kind === "CUSTOM") ?? null;

  const exact = standard.find((s) => covers(s, sizeNumber));
  if (exact) {
    return {
      size: exact,
      how: "exact",
      atTopOfRange:
        exact.fitTo === sizeNumber &&
        standard.some((s) => (s.fitFrom ?? 0) > sizeNumber),
    };
  }

  const freeFit = free.find((s) => covers(s, sizeNumber));
  if (freeFit) return { size: freeFit, how: "free", atTopOfRange: false };

  const withRange = [...standard, ...free].filter((s) => s.fitTo !== null);
  if (withRange.length > 0) {
    const biggest = Math.max(...withRange.map((s) => s.fitTo!));
    if (sizeNumber > biggest) {
      return { size: custom, how: custom ? "custom" : "none", atTopOfRange: false };
    }
    // below every range - the smallest we make is the honest answer
    const smallest = withRange.reduce((a, b) =>
      (a.fitFrom ?? 0) <= (b.fitFrom ?? 0) ? a : b
    );
    return { size: smallest, how: "smallest", atTopOfRange: false };
  }

  return { size: custom, how: custom ? "custom" : "none", atTopOfRange: false };
}

/** Kids are matched by height; age is only the fallback when height is unknown. */
export function pickKidSize(
  all: SizeOption[],
  heightCm: number | null,
  ageYears: number | null
): Pick {
  const sizes = all.filter((s) => s.active !== false && s.kind !== "CUSTOM");
  const custom = all.find((s) => s.kind === "CUSTOM") ?? null;

  if (heightCm && heightCm > 0) {
    const byHeight = sizes.find(
      (s) =>
        s.heightFrom !== null &&
        s.heightTo !== null &&
        heightCm >= s.heightFrom &&
        heightCm <= s.heightTo
    );
    if (byHeight) return { size: byHeight, how: "exact", atTopOfRange: false };

    const ranged = sizes.filter((s) => s.heightTo !== null);
    if (ranged.length > 0) {
      const tallest = Math.max(...ranged.map((s) => s.heightTo!));
      if (heightCm > tallest) {
        return { size: custom, how: custom ? "custom" : "none", atTopOfRange: false };
      }
      const smallest = ranged.reduce((a, b) =>
        (a.heightFrom ?? 0) <= (b.heightFrom ?? 0) ? a : b
      );
      return { size: smallest, how: "smallest", atTopOfRange: false };
    }
  }

  // age fallback: the labels carry the ages ("۴–۶ سال"), so match on fitFrom/To
  if (ageYears && ageYears > 0) {
    const byAge = sizes.find((s) => covers(s, ageYears));
    if (byAge) return { size: byAge, how: "exact", atTopOfRange: false };
  }

  return { size: null, how: "none", atTopOfRange: false };
}

// ── Where the hem lands ──────────────────────────────────────────────

/** Body landmarks as a fraction of standing height. */
export const shoulderHeight = (heightCm: number) => 0.82 * heightCm;
export const kneeHeight = (heightCm: number) => 0.285 * heightCm;
export const midThighHeight = (heightCm: number) => 0.42 * heightCm;

/** Height of the garment's hem above the floor, in cm. */
export const hemHeight = (heightCm: number, lengthCm: number) =>
  shoulderHeight(heightCm) - lengthCm;

const fa = (n: number) => Math.round(n).toLocaleString("fa-IR");

/**
 * One plain sentence about where the piece will fall on her - the single
 * thing a photo can't tell a buyer, and the reason she messages to ask.
 */
export function hemSentence(heightCm: number, lengthCm: number): string {
  if (!heightCm || !lengthCm) return "";
  const hem = hemHeight(heightCm, lengthCm);
  const knee = kneeHeight(heightCm);
  const thigh = midThighHeight(heightCm);
  const lead = `با قد ${fa(heightCm)}، لبه‌ی این محصول`;

  if (hem >= thigh + 6) return `${lead} بالاتر از میانه‌ی ران می‌افتد.`;
  if (hem >= thigh - 5) return `${lead} تا میانه‌ی ران می‌رسد.`;
  if (hem > knee + 3) return `${lead} حدود ${fa(hem - knee)} سانتی‌متر بالای زانو می‌افتد.`;
  if (hem >= knee - 3) return `${lead} تقریباً روی زانو می‌افتد.`;
  if (hem >= knee - 12) return `${lead} کمی پایین‌تر از زانو می‌افتد.`;
  return `${lead} حدود ${fa(knee - hem)} سانتی‌متر پایین‌تر از زانو می‌افتد.`;
}

/** The «چرا» line on the result card. */
export function whySentence(e: Estimate, input: EstimateInput): string {
  if (e.basis === "usual") return `چون معمولاً سایز ${fa(input.usualSize!)} می‌پوشی`;
  if (e.basis === "hip") return `با دور باسن ${fa(input.hipCm!)} سانتی‌متر، سایز تو حدوداً ${fa(e.size)} است`;
  return `با قد ${fa(input.heightCm!)} و وزن ${fa(input.weightKg!)}، سایز تو حدوداً ${fa(e.size)} است`;
}
