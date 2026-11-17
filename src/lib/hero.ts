/** Content only: the landing page layout and styling stay in Hero.tsx. */
export const HERO_DEFAULTS = {
  landingTitleFirst: "تابستان را",
  landingTitleAccent: "با خودت",
  landingTitleLast: "ببر",
  landingButtonText: "دیدن کلکسیون تابستان",
  landingButtonHref: "/products",
  landingImage: "/images/hero.jpg",
};

export const HERO_TEXT_FIELDS = [
  { key: "landingTitleFirst", label: "عنوان: خط اول", max: 30 },
  { key: "landingTitleAccent", label: "عنوان: بخش رنگی خط دوم", max: 18 },
  { key: "landingTitleLast", label: "عنوان: ادامه خط دوم", max: 18 },
  { key: "landingButtonText", label: "متن دکمه اصلی", max: 40 },
] as const;
export const HERO_DESTINATIONS = [
  { href: "/products", label: "همه محصولات" },
  { href: "/about", label: "درباره موآی" },
  { href: "/contact", label: "تماس با ما" },
] as const;
export type HeroContent = typeof HERO_DEFAULTS;
export type HeroSaveState = { error?: string; saved?: boolean };

export function validHeroText(value: string, max: number) {
  return !!value && value.length <= max && !/[<>\r\n\u0000-\u001f]/.test(value);
}
export function validHeroImage(value: string) {
  return value === HERO_DEFAULTS.landingImage || /^\/uploads\/[0-9a-f-]{36}\.webp$/.test(value);
}
export function heroImageSrc(value: string) {
  return validHeroImage(value) && value.startsWith("/uploads/")
    ? `/api/hero-image/${value.slice("/uploads/".length)}`
    : HERO_DEFAULTS.landingImage;
}
export function getHeroContent(settings: Record<string, string>): HeroContent {
  const content = { ...HERO_DEFAULTS };
  for (const field of HERO_TEXT_FIELDS) {
    const value = (settings[field.key] ?? "").trim();
    if (validHeroText(value, field.max)) content[field.key] = value;
  }
  if (HERO_DESTINATIONS.some(d => d.href === settings.landingButtonHref)) content.landingButtonHref = settings.landingButtonHref;
  if (validHeroImage(settings.landingImage ?? "")) content.landingImage = settings.landingImage;
  return content;
}
