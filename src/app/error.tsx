"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catches any unhandled render error so a customer never sees a blank page.
 * Without this, one bad product record could make the whole shop look dead.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[render error]", error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-sand-50 px-6 text-center">
      <span className="text-6xl">🌊</span>
      <h1 className="font-display text-4xl font-black text-sea-900 md:text-5xl">
        دریا کمی طوفانی شد
      </h1>
      <p className="max-w-sm leading-8 text-ink/75">
        مشکلی پیش آمد و این صفحه بارگذاری نشد. لطفاً دوباره تلاش کن — اگر باز هم
        تکرار شد، در واتس‌اپ خبرمان کن.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">تلاش دوباره</button>
        <Link href="/" className="btn btn-ghost">برگشت به خانه</Link>
      </div>
      {error.digest && (
        <p className="text-xs text-ink/35" dir="ltr">کد خطا: {error.digest}</p>
      )}
    </div>
  );
}
