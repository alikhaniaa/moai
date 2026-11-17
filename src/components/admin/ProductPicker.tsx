"use client";

import { useMemo, useState } from "react";

export type PickerProduct = { id: string; nameFa: string; categoryName: string };

/**
 * Type-to-filter list for choosing a product to add to a homepage slot.
 *
 * The shop has enough products that a plain `<select>` is a scroll hunt, and
 * the list is small enough that filtering it in the browser beats a round trip.
 */
export default function ProductPicker({
  products,
  chosenIds,
  slot,
  action,
}: {
  products: PickerProduct[];
  chosenIds: string[];
  slot: string;
  action: (formData: FormData) => void;
}) {
  const [q, setQ] = useState("");
  const chosen = useMemo(() => new Set(chosenIds), [chosenIds]);

  const matches = useMemo(() => {
    const term = q.trim();
    return products
      .filter((p) => !chosen.has(p.id))
      .filter((p) => !term || p.nameFa.includes(term) || p.categoryName.includes(term))
      .slice(0, 8);
  }, [q, products, chosen]);

  return (
    <div>
      <input
        className="input !py-2.5 text-sm"
        placeholder="جستجوی محصول برای افزودن…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {q.trim() && (
        <ul className="mt-2 space-y-1.5">
          {matches.map((p) => (
            <li key={p.id}>
              <form action={action}>
                <input type="hidden" name="slot" value={slot} />
                <input type="hidden" name="productId" value={p.id} />
                <button className="flex w-full items-center justify-between gap-3 rounded-xl bg-sand-100 px-4 py-2.5 text-right text-sm transition-colors hover:bg-sand-200">
                  <span className="font-semibold text-sea-900">{p.nameFa}</span>
                  <span className="shrink-0 text-xs text-ink/60">{p.categoryName}</span>
                </button>
              </form>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-3 text-sm text-ink/60">محصولی پیدا نشد.</li>
          )}
        </ul>
      )}
    </div>
  );
}
