import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-sand-50 px-6 text-center">
      <span className="text-6xl">🌊</span>
      <h1 className="font-display text-5xl font-black text-sea-900 md:text-7xl">
        موج، این صفحه را برد…
      </h1>
      <p className="max-w-sm leading-8 text-ink/75">
        صفحه‌ای که دنبالش بودی پیدا نشد؛ ولی ساحل همین نزدیکی‌ست.
      </p>
      <Link href="/" className="btn btn-primary">برگشت به خانه</Link>
    </div>
  );
}
