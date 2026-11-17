"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  slug: string;
  nameFa: string;
  image: string;
  unitPrice: number;
  qty: number;
  /** null for products that have no sizes at all. */
  sizeId?: string | null;
  sizeLabel?: string | null;
  /** null for products with no colourway of their own. */
  colorId?: string | null;
  colorName?: string | null;
};

/**
 * A line is a product *in one size and one colour*, so the same towel in S/آبی
 * and L/آبی is two lines with two prices. Everything that used to key on `id`
 * keys on this.
 */
export const lineKey = (i: { id: string; sizeId?: string | null; colorId?: string | null }) =>
  `${i.id}::${i.sizeId ?? ""}::${i.colorId ?? ""}`;

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
// v3: a v2 line carries no colour, and a colourless line for a product that
// now has colours is refused at checkout - so old carts are dropped rather than
// migrated, exactly as v1 was when sizes arrived.
const KEY = "moai_cart_v3";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
      localStorage.removeItem("moai_cart_v1");
      localStorage.removeItem("moai_cart_v2");
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const api = useMemo<CartCtx>(() => {
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const count = items.reduce((s, i) => s + i.qty, 0);
    return {
      items,
      count,
      subtotal,
      isOpen,
      setOpen,
      add: (item, qty = 1) => {
        setItems((prev) => {
          const key = lineKey(item);
          const found = prev.find((i) => lineKey(i) === key);
          if (found)
            return prev.map((i) =>
              lineKey(i) === key ? { ...i, qty: i.qty + qty } : i
            );
          return [...prev, { ...item, qty }];
        });
        setOpen(true);
      },
      setQty: (key, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => lineKey(i) !== key)
            : prev.map((i) => (lineKey(i) === key ? { ...i, qty } : i))
        ),
      remove: (key) => setItems((prev) => prev.filter((i) => lineKey(i) !== key)),
      clear: () => setItems([]),
    };
  }, [items, isOpen]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
