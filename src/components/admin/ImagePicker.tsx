"use client";

import { useRef, useState } from "react";
import Image from "next/image";

const STOCK_IMAGES = [
  "/images/surf.jpg", "/images/boho.jpg", "/images/stripes.jpg", "/images/palms.jpg",
  "/images/pool.jpg", "/images/kids.jpg", "/images/kid.jpg", "/images/bath.jpg",
  "/images/spa.jpg", "/images/hangers.jpg", "/images/shore.jpg", "/images/aerial.jpg",
];

/**
 * Choose a photo: upload a new one, or pick one of the built-in placeholders.
 * Writes the chosen path into a hidden input so it posts with the form.
 */
export default function ImagePicker({
  name,
  defaultValue,
  label = "تصویر",
}: {
  name: string;
  defaultValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? STOCK_IMAGES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showStock, setShowStock] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setValue(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "آپلود ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-sea-900">{label}</label>
      <input type="hidden" name={name} value={value} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-sand-200 bg-sand-100">
          {value && (
            <Image src={value} alt="" fill sizes="112px" className="object-cover" />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-bold">
              در حال آپلود…
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn btn-primary !py-2.5 text-sm"
            disabled={busy}
          >
            آپلود عکس جدید
          </button>
          <button
            type="button"
            onClick={() => setShowStock((s) => !s)}
            className="btn btn-ghost !py-2.5 text-sm"
          >
            {showStock ? "بستن نمونه‌ها" : "انتخاب از نمونه‌ها"}
          </button>
          <p className="max-w-xs text-xs leading-6 text-ink/68">
            JPG/PNG/WEBP تا ۸ مگابایت. بهترین نتیجه با تصویر عمودی (نسبت ۴:۵).
          </p>
          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        </div>
      </div>

      {showStock && (
        <div className="mt-4 grid grid-cols-4 gap-3 rounded-2xl bg-sand-100 p-4 md:grid-cols-6">
          {STOCK_IMAGES.map((img) => (
            <button
              type="button"
              key={img}
              onClick={() => setValue(img)}
              className={`overflow-hidden rounded-lg transition-all ${
                value === img ? "ring-3 ring-clay-500" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={img} alt="" width={100} height={125} className="aspect-[4/5] w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
