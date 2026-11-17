"use client";

import { useMemo, useState } from "react";
import {
  estimateSize, hemSentence, pickKidSize, pickSize, whySentence,
  type EstimateInput, type Fit, type SizeOption, type Who,
} from "@/lib/sizing";
import { faNum } from "@/lib/format";

const WHO: { value: Who; label: string }[] = [
  { value: "female", label: "خانم" },
  { value: "male", label: "آقا" },
  { value: "kid", label: "کودک" },
];

const FITS: { value: Fit; label: string; hint: string }[] = [
  { value: "regular", label: "معمولی", hint: "اندازه‌ی استاندارد" },
  { value: "loose", label: "کمی آزادتر", hint: "یک سایز بزرگ‌تر" },
];

const numOr = (v: string): number | null => {
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * «سایزم را پیدا کن» - the estimator form and its result card.
 *
 * All the arithmetic lives in `src/lib/sizing.ts`; this only collects numbers
 * and renders sentences. Nothing is stored or sent anywhere: it runs entirely
 * in the browser, which is also why it can be embedded on the size guide page
 * with no product behind it.
 */
export default function SizeEstimator({
  sizes,
  kidSizes,
  onPick,
  whatsapp,
  productName,
}: {
  sizes: SizeOption[];
  /**
   * The kids table, when it is a different one - the standalone guide carries
   * both. On a product page there is only ever one set, its own.
   */
  kidSizes?: SizeOption[];
  /** Given when there is a real product to select the size on. */
  onPick?: (sizeId: string) => void;
  whatsapp: string;
  productName?: string;
}) {
  const [who, setWho] = useState<Who>("female");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bust, setBust] = useState("");
  const [hip, setHip] = useState("");
  const [usual, setUsual] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const [kidAge, setKidAge] = useState("");
  const [showMeasures, setShowMeasures] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const kid = who === "kid";

  const result = useMemo(() => {
    if (!submitted) return null;

    if (kid) {
      const h = numOr(height);
      const age = numOr(kidAge);
      if (!h && !age) return { error: "قد یا سن کودک را بنویس." } as const;
      const picked = pickKidSize(kidSizes ?? sizes, h, age);
      return {
        picked,
        why: h
          ? `با قد ${faNum(h)} سانتی‌متر`
          : `با سن ${faNum(age!)} سال`,
        hem: h && picked.size?.lengthCm ? hemSentence(h, picked.size.lengthCm) : "",
        estimate: null,
      } as const;
    }

    const input: EstimateInput = {
      who,
      heightCm: numOr(height),
      weightKg: numOr(weight),
      hipCm: numOr(hip),
      bustCm: numOr(bust),
      usualSize: numOr(usual),
      fit,
    };
    const estimate = estimateSize(input);
    if (!estimate) return { error: "قد و وزنت را بنویس، یا دور باسن، یا سایز همیشگی‌ات." } as const;

    const picked = pickSize(sizes, estimate.size);
    const h = numOr(height);
    return {
      picked,
      estimate,
      why: whySentence(estimate, input),
      hem: h && picked.size?.lengthCm ? hemSentence(h, picked.size.lengthCm) : "",
    } as const;
  }, [submitted, who, kid, height, weight, hip, bust, usual, fit, kidAge, sizes, kidSizes]);

  const waText = encodeURIComponent(
    productName
      ? `سلام! برای «${productName}» مطمئن نیستم کدام سایز مناسبم است.`
      : "سلام! برای انتخاب سایز راهنمایی می‌خواستم."
  );

  return (
    <div className="space-y-5">
      {/* ── who ── */}
      <div>
        <Label>برای چه کسی؟</Label>
        <div className="flex flex-wrap gap-2">
          {WHO.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => {
                setWho(w.value);
                setSubmitted(false);
              }}
              className={`chip border transition-colors ${
                who === w.value
                  ? "border-clay-500 bg-clay-500 text-sand-50"
                  : "border-sand-200 bg-white text-ink/82 hover:border-sand-300"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {kid ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="قد کودک (سانتی‌متر)" value={height} onChange={setHeight} placeholder="۱۲۵" />
          <NumberField label="سن (سال) — اگر قد را نمی‌دانی" value={kidAge} onChange={setKidAge} placeholder="۸" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="قد (سانتی‌متر)" value={height} onChange={setHeight} placeholder="۱۶۸" />
            <NumberField label="وزن (کیلوگرم)" value={weight} onChange={setWeight} placeholder="۶۵" />
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white">
            <button
              type="button"
              onClick={() => setShowMeasures((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-sea-900"
            >
              <span>اندازه‌هایم را دارم (دقیق‌تر می‌شود)</span>
              <span className="text-ink/50">{showMeasures ? "−" : "+"}</span>
            </button>
            {showMeasures && (
              <div className="grid gap-4 border-t border-sand-200 p-4 sm:grid-cols-2">
                <NumberField label="دور سینه (سانتی‌متر)" value={bust} onChange={setBust} placeholder="۹۰" />
                <NumberField label="دور باسن (سانتی‌متر)" value={hip} onChange={setHip} placeholder="۱۰۰" />
              </div>
            )}
          </div>

          <NumberField
            label="سایز لباس معمولی‌ات (۳۶ تا ۵۶) — اگر می‌دانی"
            value={usual}
            onChange={setUsual}
            placeholder="۴۰"
          />

          <div>
            <Label>فرم دلخواه</Label>
            <div className="flex flex-wrap gap-2">
              {FITS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFit(f.value)}
                  title={f.hint}
                  className={`chip border transition-colors ${
                    fit === f.value
                      ? "border-sea-700 bg-sea-700 text-sand-50"
                      : "border-sand-200 bg-white text-ink/82 hover:border-sand-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setSubmitted(true)}
        className="btn btn-primary w-full"
      >
        سایزم را پیدا کن
      </button>

      {/* ── result ── */}
      {result && "error" in result && (
        <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-semibold text-clay-700">
          {result.error}
        </p>
      )}

      {result && !("error" in result) && (
        <div className="rounded-3xl border border-sea-200 bg-sea-100/60 p-5">
          {result.picked.size ? (
            <>
              <div className="text-xs font-semibold text-ink/68">سایز پیشنهادی</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-4xl font-black text-sea-900">
                  {result.picked.size.label}
                </span>
                {result.picked.how === "custom" && (
                  <span className="chip bg-gold/25 text-clay-800">با هماهنگی</span>
                )}
              </div>

              <p className="mt-3 text-sm leading-7 text-ink/82">
                {result.why}
                {result.estimate && result.picked.how !== "custom" && (
                  <> → سایز {result.picked.size.label}</>
                )}
                {result.picked.how === "free" && " — این محصول فری‌سایز است و این اندازه را می‌پوشاند."}
                {result.picked.how === "custom" &&
                  " — این اندازه بزرگ‌تر از سایزهای آماده‌ی این محصول است و باید سفارشی دوخته شود."}
                {result.picked.how === "smallest" &&
                  " — کوچک‌ترین سایزی که از این محصول می‌دوزیم همین است."}
              </p>

              {result.hem && (
                <p className="mt-2 text-sm leading-7 text-sea-800">{result.hem}</p>
              )}

              {(result.estimate?.betweenSizes || result.picked.atTopOfRange) &&
                result.picked.how !== "custom" && (
                  <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-sm leading-7 text-clay-700">
                    بین دو سایزی؛ سایز بزرگ‌تر راحت‌تر است.
                  </p>
                )}

              {result.picked.how === "custom" ? (
                <a
                  href={`https://wa.me/${whatsapp}?text=${waText}`}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-primary mt-4 w-full"
                >
                  هماهنگی سایز سفارشی در واتس‌اپ
                </a>
              ) : (
                onPick && (
                  <button
                    type="button"
                    onClick={() => onPick(result.picked.size!.id)}
                    className="btn btn-primary mt-4 w-full"
                  >
                    همین سایز را انتخاب کن
                  </button>
                )
              )}
            </>
          ) : (
            <p className="text-sm leading-7 text-ink/82">
              با این اندازه‌ها سایز آماده‌ای پیدا نکردیم. در واتس‌اپ بپرس تا با هم
              انتخاب کنیم.
            </p>
          )}

          <p className="mt-4 border-t border-sea-200/70 pt-3 text-xs leading-6 text-ink/68">
            این فقط یک تخمین است و ±۱ سایز خطا دارد؛ اگر مطمئن نیستی{" "}
            <a
              href={`https://wa.me/${whatsapp}?text=${waText}`}
              target="_blank"
              rel="noopener"
              className="font-bold text-sea-700 underline underline-offset-4"
            >
              در واتس‌اپ بپرس
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-sm font-semibold text-sea-900">{children}</div>;
}

function NumberField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-sea-900">{label}</label>
      <input
        className="input"
        dir="ltr"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
