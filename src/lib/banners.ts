import { db } from "./db";

/**
 * The «قصه ما» collage photos are stored as banners too, in their own slot, so
 * the shop can swap them from بنرها without a developer. They are NOT promo
 * cards, so every other banner query has to exclude this slot.
 */
export const STORY_SLOT = "STORY";

/** Switched on and inside its date window right now. */
const liveNow = (now: Date) => ({
  active: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ],
});

/** Promo banners for the homepage strip. */
export async function getActiveBanners() {
  return db.banner.findMany({
    where: { ...liveNow(new Date()), slot: { not: STORY_SLOT } },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
  });
}

export type BannerData = Awaited<ReturnType<typeof getActiveBanners>>[number];

export type StoryPhotos = {
  /** the large photo */
  main: { url: string; alt: string };
  /** the small polaroid pinned over its corner, with its handwritten caption */
  inset: { url: string; alt: string; caption: string };
};

/** What the site launched with - used until the shop uploads its own. */
const STORY_FALLBACK: StoryPhotos = {
  main: { url: "/images/shore.jpg", alt: "ساحل آرام" },
  inset: {
    url: "/images/stripes.jpg",
    alt: "بافت پارچه نخی",
    caption: "بافتِ نرمِ پنبه",
  },
};

/**
 * The two «قصه ما» photos, lowest `sort` first: the big one, then the polaroid.
 * A missing or half-filled slot falls back rather than leaving a hole in the
 * page, so deleting a row can never break the section.
 */
export async function getStoryPhotos(): Promise<StoryPhotos> {
  const rows = await db.banner.findMany({
    where: { ...liveNow(new Date()), slot: STORY_SLOT },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    take: 2,
  });

  const [main, inset] = rows;
  return {
    main: main ? { url: main.image, alt: main.title } : STORY_FALLBACK.main,
    inset: inset
      ? {
          url: inset.image,
          alt: inset.title,
          // the caption is the only place a STORY subtitle is shown
          caption: inset.subtitle?.trim() || STORY_FALLBACK.inset.caption,
        }
      : STORY_FALLBACK.inset,
  };
}
