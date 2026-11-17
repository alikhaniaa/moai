import { db } from "./db";
import { HERO_DEFAULTS } from "./hero";
import { shiftDay, tehranDay } from "./visits";
import { APPEARANCE_DEFAULTS } from "./appearance";

/**
 * Site-wide content the shop owner can edit without a developer.
 * Anything in here is editable at /admin/settings.
 */
export const SETTING_DEFS = [
  { key: "shopPhone", label: "شماره تماس", group: "تماس", def: "09121230000" },
  { key: "shopWhatsapp", label: "واتس‌اپ (بدون صفر، با کد کشور)", group: "تماس", def: "989121230000" },
  { key: "shopEmail", label: "ایمیل", group: "تماس", def: "info@example.com" },
  { key: "shopAddress", label: "آدرس", group: "تماس", def: "تهران" },
  { key: "shopInstagram", label: "اینستاگرام (بدون @)", group: "تماس", def: "moai.gallery" },
  { key: "shopBale", label: "آی‌دی بله (بدون @ — خالی = این گزینه نمایش داده نمی‌شود)", group: "تماس", def: "" },

  // دکمه‌ی شناور تماس - its channels come from the «تماس» fields above
  { key: "contactTitle", label: "دکمه‌ی تماس: عنوان", group: "دکمه‌ی تماس", def: "سوالی دارید؟" },
  { key: "contactSubtitle", label: "دکمه‌ی تماس: زیرعنوان", group: "دکمه‌ی تماس", def: "با ما در ارتباط باشید." },

  // کارت به کارت - editable here so a change of card never needs a developer
  { key: "cardNumber", label: "شماره کارت (۱۶ رقم، بدون فاصله)", group: "کارت به کارت", def: "6219860000000000" },
  { key: "cardHolder", label: "نام صاحب کارت", group: "کارت به کارت", def: "نام صاحب حساب" },
  { key: "cardBank", label: "نام بانک", group: "کارت به کارت", def: "بانک سامان" },

  { key: "shippingCost", label: "هزینه ارسال (تومان)", group: "ارسال", def: "0", type: "number" },
  { key: "freeShippingFrom", label: "ارسال رایگان از (تومان، ۰ = غیرفعال)", group: "ارسال", def: "15000000", type: "number" },
  { key: "snapppayNote", label: "متن اسنپ‌پی در تسویه حساب", group: "ارسال", type: "textarea", def: "برای دریافت این محصول با اسنپ‌پی، با ما در ارتباط باشید." },
  { key: "shippingNote", label: "توضیح ارسال", group: "ارسال", def: "ارسال سفارش‌ها از طریق تیپاکس و با هزینه‌ی مشتری انجام می‌شود. برای مشتریان تهران امکان ارسال با پیک هم هست (هزینه بر عهده‌ی مشتری)." },

  { key: "announcement", label: "نوار اعلان بالای سایت (خالی = مخفی)", group: "محتوا", def: "ارسال به سراسر ایران با تیپاکس ✦ کالکشن نسخه‌ی محدود" },

  // پاپ‌آپ اعلان - a one-off notice that greets visitors a few seconds in.
  // The window is a start day plus a number of days; see popupNotice() below.
  { key: "popupEnabled", label: "پاپ‌آپ روشن باشد", group: "پاپ‌آپ اعلان", def: "0", type: "checkbox" },
  { key: "popupTitle", label: "عنوان پاپ‌آپ", group: "پاپ‌آپ اعلان", def: "توجه" },
  { key: "popupText", label: "متن پاپ‌آپ (خالی = نمایش داده نمی‌شود)", group: "پاپ‌آپ اعلان", type: "textarea", def: "" },
  { key: "popupCode", label: "کد تخفیف داخل پاپ‌آپ (خالی = دکمه‌ی کپی نشان داده نمی‌شود)", group: "پاپ‌آپ اعلان", def: "" },
  { key: "popupStartsAt", label: "شروع نمایش از تاریخ", group: "پاپ‌آپ اعلان", def: "", type: "date" },
  { key: "popupDays", label: "چند روز نمایش داده شود (۰ = بی‌پایان)", group: "پاپ‌آپ اعلان", def: "10", type: "number" },
  { key: "popupDelay", label: "چند ثانیه بعد از ورود باز شود", group: "پاپ‌آپ اعلان", def: "5", type: "number" },

  // بخش‌های صفحه اصلی - محصولات هر بخش در «صفحه اصلی» انتخاب می‌شوند
  { key: "homeShowcaseEyebrow", label: "ویترین: تیتر کوچک", group: "بخش‌های صفحه اصلی", def: "کلکسیون تابستان" },
  // *واژه* را در عنوان ویترین بگذار تا آن واژه رنگی شود؛ خط جدید هم حفظ می‌شود
  { key: "homeShowcaseTitle", label: "ویترین: عنوان (هر واژه بین دو ستاره رنگی می‌شود)", group: "بخش‌های صفحه اصلی", type: "textarea", def: "چیزهایی که\n*دریا* را صدا می‌زنند" },
  { key: "homeShowcaseSub", label: "ویترین: توضیح", group: "بخش‌های صفحه اصلی", type: "textarea", def: "منتخب محبوب‌ترین‌های موآی؛ اسکرول کن و بگذار موج تو را ببرد. هر کدام دست‌دوزِ کارگاه خودمان‌اند و فقط تعداد محدودی از هرکدام داریم." },

  { key: "homePopularEyebrow", label: "محبوب‌ترین: تیتر کوچک", group: "بخش‌های صفحه اصلی", def: "محبوبِ دل‌ها…" },
  { key: "homePopularTitle", label: "محبوب‌ترین: عنوان", group: "بخش‌های صفحه اصلی", def: "محبوب‌ترین" },
  { key: "homePopularSub", label: "محبوب‌ترین: توضیح", group: "بخش‌های صفحه اصلی", type: "textarea", def: "همان‌هایی که مدام تمام می‌شوند و دوباره می‌دوزیم." },

  { key: "homeSpecialEyebrow", label: "نسخه محدود: تیتر کوچک", group: "بخش‌های صفحه اصلی", def: "فقط چند عدد از هرکدام…" },
  { key: "homeSpecialTitle", label: "نسخه محدود: عنوان", group: "بخش‌های صفحه اصلی", def: "نسخه محدود" },
  { key: "homeSpecialSub", label: "نسخه محدود: توضیح", group: "بخش‌های صفحه اصلی", type: "textarea", def: "فقط چند عدد از هرکدام، نسخه محدود" },


  // درباره ما - متن‌های قابل ویرایش
  { key: "aboutIntro", label: "درباره ما: جمله‌ی معرفی", group: "درباره ما", type: "textarea", def: "موآی گالری جایی‌ست برای کسانی که به استایل، کیفیت و حس خوب سفر و آرامش اهمیت می‌دهند. ما با عشق و دقت محصولاتی طراحی و تولید می‌کنیم که هم کاربردی باشند و هم متفاوت." },
  { key: "aboutStory", label: "درباره ما: داستان برند", group: "درباره ما", type: "textarea", def: "همه‌چیز از یک کارگاه کوچک در تهران شروع شد؛ چند طاقه پارچه‌ی نخی، یک چرخ خیاطی و این سوال ساده: «چرا حوله‌ای که در پینترست می‌بینیم، در ایران پیدا نمی‌شود؟»" },
  { key: "aboutText", label: "متن کوتاه درباره (فوتر و جاهای دیگر)", group: "درباره ما", type: "textarea", def: "موآی گالری جایی‌ست برای کسانی که به استایل، کیفیت و حس خوب سفر و آرامش اهمیت می‌دهند." },

  // آمار برند (روی صفحه درباره ما و خانه نمایش داده می‌شود)
  { key: "statFollowers", label: "تعداد دنبال‌کننده اینستاگرام", group: "آمار برند", def: "7591" },
  { key: "statProducts", label: "تعداد طرح/محصول", group: "آمار برند", def: "124" },
  { key: "statCustomers", label: "تعداد مشتری راضی", group: "آمار برند", def: "3000" },
  { key: "statYears", label: "سال‌های فعالیت", group: "آمار برند", def: "3" },

  // باشگاه مشتریان - اعداد کارکردی (سطح‌ها جداگانه در صفحه باشگاه ویرایش می‌شوند)
  { key: "clubWelcomePoints", label: "امتیاز هدیه‌ی عضویت", group: "باشگاه", def: "50", type: "number" },
  { key: "clubPointsPer100k", label: "امتیاز به ازای هر ۱۰۰ هزار تومان خرید", group: "باشگاه", def: "10", type: "number" },
] as const;

export type Settings = Record<string, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const map: Settings = { ...APPEARANCE_DEFAULTS, ...HERO_DEFAULTS, ...Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.def])) };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export const num = (s: Settings, key: string) => Number(s[key] ?? 0) || 0;

/** Shipping for a given goods subtotal, honouring the free-shipping threshold. */
export function shippingFor(settings: Settings, goodsTotal: number) {
  const threshold = num(settings, "freeShippingFrom");
  if (threshold > 0 && goodsTotal >= threshold) return 0;
  return num(settings, "shippingCost");
}

// ── پاپ‌آپ اعلان ─────────────────────────────────────────────────────

export type PopupNotice = {
  title: string;
  text: string;
  /** how long after the page settles the card opens */
  delayMs: number;
  /** a discount code to show with a copy button; "" = no code */
  code: string;
  /** changes whenever the wording does, so an edited notice shows again */
  version: string;
};

/** Cheap, stable fingerprint of the wording - only ever used as a storage key. */
function signature(...parts: string[]): string {
  const raw = parts.join("\u0000");
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * The notice window, as Tehran calendar days.
 *
 * An empty start day means «تا وقتی روشن است» - no limit at all, and the day
 * count is then meaningless. With a start day, `popupDays` closes the window
 * that many days later (the start day itself counts as the first), and 0 keeps
 * it open. Days are compared as YYYY-MM-DD strings so the notice turns over at
 * Tehran midnight rather than the VPS clock's.
 */
export function popupWindow(s: Settings) {
  const from = (s.popupStartsAt ?? "").trim();
  const days = Math.max(0, Number(s.popupDays) || 0);
  return { from, days, until: from && days > 0 ? shiftDay(from, days - 1) : "" };
}

/** What the storefront should show right now, or null when it should show nothing. */
export function popupNotice(s: Settings, now: Date = new Date()): PopupNotice | null {
  if (s.popupEnabled !== "1") return null;

  const text = (s.popupText ?? "").trim();
  if (!text) return null;

  const { from, until } = popupWindow(s);
  const today = tehranDay(now);
  if (from && today < from) return null; // its start day hasn't arrived
  if (until && today > until) return null; // its days are up

  const title = (s.popupTitle ?? "").trim() || "توجه";
  // codes are typed by hand, so normalise the way the checkout will read it
  const code = (s.popupCode ?? "").trim().toUpperCase().replace(/ +/g, "");
  const delaySec = Number(s.popupDelay);
  return {
    title,
    text,
    code,
    delayMs: Math.max(0, Number.isFinite(delaySec) ? delaySec : 5) * 1000,
    version: signature(title, text, code),
  };
}

// ── دکمه‌ی شناور تماس ────────────────────────────────────────────────

export type ContactChannel = {
  key: "whatsapp" | "bale" | "phone";
  label: string;
  /** shown under the label - the number or the id, never a URL */
  value: string;
  href: string;
  /** messengers open in a new tab; tel: must not */
  external: boolean;
};

/** Digits only - all a wa.me link needs, and nothing it doesn't. */
const digitsOnly = (raw: string) => (raw ?? "").replace(/\D/g, "");

/**
 * A ble.ir path from whatever the shop typed: a bare id, an @id, or a pasted
 * link. Scheme and host are stripped and only id characters survive, so the
 * href below is always `https://ble.ir/…` - which is what stops a mistyped or
 * malicious value from ever becoming a `javascript:` URL or a look-alike
 * domain. `join/XXXX` group links keep working because `/` is allowed.
 */
const balePath = (raw: string) =>
  (raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?ble\.ir/i, "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_./-]/g, "")
    .replace(/^\/+|\/+$/g, "");

/**
 * The ways to reach the shop, in the order the widget lists them. A channel
 * whose field is empty is left out entirely rather than rendered as a dead
 * link, so the shop can add بله whenever it has one.
 */
export function contactChannels(s: Settings): ContactChannel[] {
  const out: ContactChannel[] = [];

  const wa = digitsOnly(s.shopWhatsapp);
  if (wa)
    out.push({ key: "whatsapp", label: "واتس‌اپ", value: `+${wa}`, href: `https://wa.me/${wa}`, external: true });

  const bale = balePath(s.shopBale);
  if (bale)
    out.push({
      key: "bale",
      label: "بله",
      value: bale.includes("/") ? `ble.ir/${bale}` : `@${bale}`,
      href: `https://ble.ir/${bale}`,
      external: true,
    });

  const tel = (s.shopPhone ?? "").replace(/[^\d+]/g, "");
  if (tel) out.push({ key: "phone", label: "تماس تلفنی", value: tel, href: `tel:${tel}`, external: false });

  return out;
}
