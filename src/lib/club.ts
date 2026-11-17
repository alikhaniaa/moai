export type Tier = {
  key: string;
  nameFa: string;
  emoji: string;
  min: number;
  color: string;
  perks: string[];
};

// gradient backgrounds assigned by tier order (kept out of the DB so the shop
// owner never has to touch Tailwind classes)
export const TIER_COLORS = [
  "from-sand-200 to-sand-100",
  "from-clay-300 to-sand-100",
  "from-sea-200 to-sand-100",
  "from-gold/40 to-sand-100",
];

/** Fallback tiers - used when the ClubTier table is empty, so the club never
 *  renders blank even before it's seeded. */
export const DEFAULT_TIERS: Tier[] = [
  {
    key: "sadaf",
    nameFa: "صدف",
    emoji: "🐚",
    min: 0,
    color: TIER_COLORS[0],
    perks: ["۱۰ امتیاز به ازای هر ۱۰۰ هزار تومان خرید", "خبر زودهنگام از کلکسیون‌های جدید", "هدیه کوچک تولد"],
  },
  {
    key: "marjan",
    nameFa: "مرجان",
    emoji: "🪸",
    min: 500,
    color: TIER_COLORS[1],
    perks: ["٪۵ تخفیف همیشگی", "ارسال رایگان اولین سفارش هر فصل", "دسترسی زودتر به حراج‌ها"],
  },
  {
    key: "morvarid",
    nameFa: "مروارید",
    emoji: "🫧",
    min: 1500,
    color: TIER_COLORS[2],
    perks: ["٪۱۰ تخفیف همیشگی", "ارسال رایگان همه سفارش‌ها", "پیش‌خرید محصولات محدود", "هدیه ویژه سالگرد عضویت"],
  },
];

// backward-compatible alias for components that import a static list
export const TIERS = DEFAULT_TIERS;

export const tierOf = (points: number, tiers: Tier[] = DEFAULT_TIERS): Tier =>
  [...tiers].sort((a, b) => b.min - a.min).find((t) => points >= t.min) ??
  tiers[0] ??
  DEFAULT_TIERS[0];

export const nextTier = (points: number, tiers: Tier[] = DEFAULT_TIERS): Tier | null =>
  [...tiers].sort((a, b) => a.min - b.min).find((t) => t.min > points) ?? null;

/** هر ۱۰۰ هزار تومان خرید = امتیاز (پیش‌فرض ۱۰) */
export const pointsForOrder = (totalToman: number, per100k = 10) =>
  Math.floor(totalToman / 100_000) * per100k;
