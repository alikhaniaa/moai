export const faNum = (n: number | string) => Number(n).toLocaleString("fa-IR");

export const toman = (n: number) => `${faNum(n)} تومان`;

export const discountPct = (price: number, sale: number) =>
  Math.round((1 - sale / price) * 100);

export const faDate = (d: Date | string) =>
  new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(d));

export const faTime = (d: Date | string) =>
  new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));

/** Human-friendly, unique order/transaction code shown to buyer and admin. */
export const orderCode = (id: string) => id.slice(-8).toUpperCase();

export const ORDER_STATUS_FA: Record<string, string> = {
  AWAITING_PAYMENT: "در انتظار پرداخت",
  AWAITING_SNAPPPAY: "در انتظار تأیید اسنپ‌پی",
  AWAITING_TRANSFER: "در انتظار تأیید کارت به کارت",
  PAID: "پرداخت شده",
  DISPATCHING: "در حال آماده سازی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل شده",
  CANCELLED: "لغو شده",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  AWAITING_PAYMENT: "bg-gold/15 text-clay-700",
  AWAITING_SNAPPPAY: "bg-[#007DFA]/12 text-[#0062c4]",
  AWAITING_TRANSFER: "bg-gold/20 text-clay-800",
  PAID: "bg-sea-100 text-sea-700",
  DISPATCHING: "bg-gold/20 text-clay-700",
  SHIPPED: "bg-sea-200 text-sea-800",
  DELIVERED: "bg-sea-300 text-sea-900",
  CANCELLED: "bg-red-100 text-red-700",
};
