"use client";

import { useState } from "react";

/**
 * The کارت به کارت details a buyer needs, with copy buttons.
 *
 * Card numbers get mistyped, so the number is grouped in fours and copied as
 * bare digits (no spaces) - that is the form every banking app expects in its
 * destination field.
 */
export default function CardTransferBox({
  cardNumber,
  cardHolder,
  cardBank,
  amountLabel,
  amountRaw,
}: {
  cardNumber: string;
  cardHolder: string;
  cardBank: string;
  amountLabel: string;
  amountRaw: number;
}) {
  const [copied, setCopied] = useState<"card" | "amount" | null>(null);
  const digits = cardNumber.replace(/\D/g, "");
  const grouped = digits.replace(/(\d{4})(?=\d)/g, "$1 ");

  const copy = async (value: string, which: "card" | "amount") => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard is blocked on insecure origins and some in-app browsers - 
      // fall back to a selection the buyer can copy by hand
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="rounded-2xl bg-sand-100 p-5 ring-1 ring-sand-300">
      <div className="text-xs font-semibold text-ink/60">شماره کارت</div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span
          className="select-all font-display text-2xl font-black tracking-wider text-sea-900"
          dir="ltr"
        >
          {grouped}
        </span>
        <button
          type="button"
          onClick={() => copy(digits, "card")}
          className="btn btn-dark !px-5 !py-2 text-xs"
        >
          {copied === "card" ? "کپی شد ✓" : "کپی شماره کارت"}
        </button>
      </div>

      <div className="mt-4 space-y-2 border-t border-sand-300 pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink/68">به نام</span>
          <b className="text-sea-900">{cardHolder}</b>
        </div>
        {cardBank && (
          <div className="flex justify-between">
            <span className="text-ink/68">بانک</span>
            <b className="text-sea-900">{cardBank}</b>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-ink/68">مبلغ دقیق واریز</span>
          <span className="flex items-center gap-2">
            <b className="text-clay-600">{amountLabel}</b>
            <button
              type="button"
              onClick={() => copy(String(amountRaw), "amount")}
              className="rounded-lg border border-sand-300 px-2 py-1 text-[11px] text-ink/70 transition-colors hover:border-clay-400 hover:text-clay-600"
            >
              {copied === "amount" ? "کپی شد ✓" : "کپی مبلغ"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
