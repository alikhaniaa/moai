import { createHash } from "crypto";

export const SITE_NAME = "موآی گالری";
export const SITE_URL = (process.env.SITE_URL ?? "https://moaigallery.ir").replace(/\/$/, "");

/** The line the site has always led with - kept here so the homepage snippet,
 *  the share card and the structured data all say the same thing. */
export const TAGLINE = "دریا حالِ آدم را خوب می‌کند";

export const SITE_DESCRIPTION =
  `${TAGLINE} — تولید و طراحی حوله و زیرانداز ساحلی از جنس الیاف طبیعی نخ پنبه؛ ` +
  "دست‌دوز، خاص و از اولین‌ها در ایران. ارسال به سراسر کشور.";

/** 1200x630, JPEG. Regenerate with `npm run brand` after a logo change. */
export const DEFAULT_OG_IMAGE = {
  url: "/images/og-default.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: SITE_NAME,
};

/**
 * Meta descriptions are a single line of plain text. Product copy is
 * multi-line and starts with emoji, so collapse it and cut on a word
 * boundary - otherwise the tag carries raw newlines and crawlers show
 * only the first line.
 */
export function metaDescription(text: string, fallback: string, max = 155): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * Share card for a product. The `v` stamp is derived from the photo path, so
 * swapping the photo produces a new URL and the messengers - which cache
 * previews aggressively and for a long time - fetch it again.
 */
export function productOgImage(slug: string, image: string) {
  const v = createHash("sha1").update(image).digest("hex").slice(0, 8);
  return {
    url: `/og/${encodeURIComponent(slug)}?v=${v}`,
    width: 1200,
    height: 630,
    type: "image/jpeg",
  };
}
