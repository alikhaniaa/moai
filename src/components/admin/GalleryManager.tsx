"use client";

import { useEffect, useRef, useState } from "react";

const STOCK = [
  "/images/surf.jpg", "/images/boho.jpg", "/images/stripes.jpg", "/images/palms.jpg",
  "/images/pool.jpg", "/images/kids.jpg", "/images/kid.jpg", "/images/bath.jpg",
  "/images/spa.jpg", "/images/hangers.jpg", "/images/shore.jpg", "/images/aerial.jpg",
];

/**
 * Manages ALL photos for a product: the first image is the main one, the rest
 * are the gallery. Supports uploading several at once, deleting, and choosing
 * which is main. The full ordered list is submitted as a JSON hidden field.
 * Uses a plain <img> so previews never depend on the (disabled) optimizer.
 */
export default function GalleryManager({
  name,
  initial,
  label = "عکس‌های محصول",
  onChange,
}: {
  name: string;
  initial: string[];
  label?: string;
  /** so «رنگ‌بندی» can offer these photos while they are still unsaved */
  onChange?: (images: string[]) => void;
}) {
  const [images, setImages] = useState<string[]>(initial.filter(Boolean));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showStock, setShowStock] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The colour rows pick from this same list, so they have to hear about an
  // upload or a delete before the form is submitted.
  useEffect(() => {
    onChange?.(images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const uploadFiles = async (files: FileList) => {
    setBusy(true);
    setError("");
    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        added.push(data.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "آپلود یکی از عکس‌ها ناموفق بود.");
      }
    }
    if (added.length) setImages((prev) => [...prev, ...added]);
    setBusy(false);
  };

  const remove = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const makeMain = (i: number) =>
    setImages((prev) => [prev[i], ...prev.filter((_, idx) => idx !== i)]);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-sea-900">{label}</label>
      <input type="hidden" name={name} value={JSON.stringify(images)} />

      <p className="mb-3 text-xs leading-6 text-ink/68">
        اولین عکس، عکس اصلی محصول است. می‌توانی چند عکس با هم آپلود کنی، حذف کنی،
        یا با دکمه‌ی «اصلی» ترتیب را عوض کنی. بهترین نتیجه با عکس عمودی (نسبت ۴:۵).
      </p>

      {images.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {images.map((src, i) => (
            <div
              key={src + i}
              className={`group relative aspect-[4/5] overflow-hidden rounded-xl border-2 ${
                i === 0 ? "border-clay-500" : "border-sand-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 right-1 rounded-full bg-clay-500 px-2 py-0.5 text-[10px] font-bold text-sand-50">
                  اصلی
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/45 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeMain(i)}
                    className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold text-sea-900"
                  >
                    اصلی کن
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="mr-auto rounded bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-primary !py-2.5 text-sm">
          {busy ? "در حال آپلود…" : "➕ آپلود عکس (چند تا هم می‌شود)"}
        </button>
        <button type="button" onClick={() => setShowStock((s) => !s)} className="btn btn-ghost !py-2.5 text-sm">
          {showStock ? "بستن نمونه‌ها" : "افزودن از نمونه‌ها"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      {images.length === 0 && (
        <p className="mt-2 text-xs font-semibold text-clay-600">حداقل یک عکس اضافه کن.</p>
      )}

      {showStock && (
        <div className="mt-4 grid grid-cols-4 gap-3 rounded-2xl bg-sand-100 p-4 md:grid-cols-6">
          {STOCK.map((img) => (
            <button
              type="button"
              key={img}
              onClick={() => setImages((prev) => (prev.includes(img) ? prev : [...prev, img]))}
              className="overflow-hidden rounded-lg opacity-70 transition-all hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="aspect-[4/5] w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
