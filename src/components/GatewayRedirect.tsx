"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-submitting form that hands the buyer over to the payment gateway.
 *
 * It must be a real form submission from a page on our own domain: SEP checks
 * the Referrer header and refuses entries that arrive without it, so a plain
 * server-side redirect would be rejected.
 */
export default function GatewayRedirect({
  action,
  token,
  amountLabel,
  sandbox = false,
}: {
  action: string;
  token: string;
  amountLabel: string;
  sandbox?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const t = setTimeout(() => form.current?.submit(), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="relative grid h-24 w-24 place-items-center">
        <span className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-clay-300" />
        <span className="text-4xl">🔐</span>
      </div>

      <h1 className="mt-8 font-display text-3xl font-bold text-sea-900 md:text-4xl">
        در حال انتقال به درگاه پرداخت…
      </h1>
      <p className="mt-3 leading-8 text-ink/75">
        مبلغ قابل پرداخت: <b className="text-sea-900">{amountLabel}</b>
        <br />
        لطفاً این صفحه را نبند؛ چند لحظه دیگر به صفحه‌ی امن بانک می‌روی.
      </p>

      <form ref={form} action={action} method="post" className="mt-8">
        <input type="hidden" name="Token" value={token} />
        <input type="hidden" name="GetMethod" value="false" />
        <button type="submit" className="btn btn-primary">
          اگر منتقل نشدی، این‌جا بزن
        </button>
      </form>

      {sandbox && (
        <p className="mt-6 rounded-xl border border-dashed border-gold bg-gold/10 px-4 py-3 text-xs leading-6 text-clay-700">
          🔧 حالت آزمایشی: این یک درگاه شبیه‌سازی‌شده است و پول واقعی جابه‌جا
          نمی‌شود. برای اتصال به بانک، در فایل <code dir="ltr">.env</code> مقدار{" "}
          <code dir="ltr">SEP_SANDBOX</code> را صفر کن.
        </p>
      )}
    </section>
  );
}
