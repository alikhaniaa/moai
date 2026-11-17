"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart, lineKey } from "@/lib/cart";
import { toman, faNum } from "@/lib/format";

export default function CartDrawer() {
  const { items, subtotal, isOpen, setOpen, setQty, remove } = useCart();

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[180] bg-sea-900/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[190] flex w-full max-w-md flex-col bg-sand-50 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-sand-200 px-6 py-5">
          <h2 className="font-display text-2xl font-bold text-sea-900">سبد خرید</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="بستن"
            className="grid h-9 w-9 place-items-center rounded-full text-sea-900 hover:bg-sea-900/5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="text-5xl">🏖️</span>
            <p className="font-semibold text-sea-900">سبدت هنوز خالی است</p>
            <p className="text-sm text-ink/75">
              یک حوله‌ی خوب، نصف تعطیلات است…
            </p>
            <Link href="/products" onClick={() => setOpen(false)} className="btn btn-primary mt-2">
              دیدن فروشگاه
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {items.map((item) => (
                <li key={lineKey(item)} className="flex gap-4">
                  <div className="img-frame h-24 w-20 shrink-0 !rounded-xl">
                    <Image
                      src={item.image}
                      alt={item.nameFa}
                      width={80}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={() => setOpen(false)}
                      className="text-sm font-semibold leading-6 text-sea-900 hover:text-clay-600"
                    >
                      {item.nameFa}
                    </Link>
                    {(item.sizeLabel || item.colorName) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.sizeLabel && (
                          <span className="w-fit rounded-full bg-sea-100 px-2.5 py-0.5 text-[11px] font-bold text-sea-700">
                            سایز {item.sizeLabel}
                          </span>
                        )}
                        {item.colorName && (
                          <span className="w-fit rounded-full bg-clay-500/12 px-2.5 py-0.5 text-[11px] font-bold text-clay-700">
                            {item.colorName}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="mt-1 text-xs text-ink/75">{toman(item.unitPrice)}</span>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-3 rounded-full border border-sand-200 bg-white px-3 py-1">
                        <button onClick={() => setQty(lineKey(item), item.qty + 1)} className="text-lg text-sea-900">+</button>
                        <span className="min-w-4 text-center text-sm font-bold">{faNum(item.qty)}</span>
                        <button onClick={() => setQty(lineKey(item), item.qty - 1)} className="text-lg text-sea-900">−</button>
                      </div>
                      <button
                        onClick={() => remove(lineKey(item))}
                        className="text-xs text-ink/68 underline-offset-4 hover:text-clay-600 hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-sand-200 bg-white px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-ink/75">جمع سبد</span>
                <span className="price-lg text-sea-900">{toman(subtotal)}</span>
              </div>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                ادامه و ثبت سفارش
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="mt-2 w-full text-center text-sm text-ink/75 hover:text-sea-900"
              >
                ادامه خرید
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
