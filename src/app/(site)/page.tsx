import type { Metadata } from "next";
import { getActiveCampaigns } from "@/lib/pricing";
import { getActiveBanners, getStoryPhotos } from "@/lib/banners";
import { getHomeFeatures, getShowcaseFallback } from "@/lib/home";
import { getSettings, num } from "@/lib/settings";
import { getClubTiers } from "@/lib/club-data";
import BannerStrip from "@/components/home/BannerStrip";
import Hero from "@/components/home/Hero";
import { getHeroContent } from "@/lib/hero";
import Marquee from "@/components/Marquee";
import HorizontalShowcase from "@/components/home/HorizontalShowcase";
import ProductRow from "@/components/home/ProductRow";
import LimitedEdition from "@/components/home/LimitedEdition";
import Story from "@/components/home/Story";
import ClubTeaser from "@/components/home/ClubTeaser";
import FeatureBand from "@/components/home/FeatureBand";
import FinalCTA from "@/components/home/FinalCTA";

export const dynamic = "force-dynamic";

// Title, description and share card are inherited from the root layout; only
// the canonical is per-page (the layout can't set one - it would be inherited
// by every route).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function Home() {
  const campaigns = await getActiveCampaigns();
  const [features, banners, s, tiers, storyPhotos] = await Promise.all([
    getHomeFeatures(campaigns),
    getActiveBanners(),
    getSettings(),
    getClubTiers(),
    getStoryPhotos(),
  ]);

  // The curated list is the section; `featured` is only the safety net for a
  // shop that hasn't picked anything yet.
  const showcase =
    features.SHOWCASE.length > 0
      ? features.SHOWCASE.slice(0, 8)
      : await getShowcaseFallback(campaigns);

  // نسخه محدود shows ONE piece - the first of the list - and the rest sit
  // behind «همه‌ی نسخه‌های محدود».
  const [limitedHero, ...limitedRest] = features.SPECIAL;

  return (
    <>
      <Hero content={getHeroContent(s)} />

      {/* energy strip */}
      <div className="relative z-10 border-y border-clay-600 bg-clay-500 py-3.5 text-sand-50 shadow-lg">
        <Marquee
          items={[
            "حراج تابستانه تا ٪۳۵",
            "زیرانداز ساحلی",
            "حوله پینترستی",
            "پانچو کلاه‌دار",
            "ارسال به سراسر ایران",
            "دست‌دوز با پنبه طبیعی",
          ]}
          className="text-sm font-bold"
          separator="🌊"
        />
      </div>

      <HorizontalShowcase
        products={showcase}
        eyebrow={s.homeShowcaseEyebrow}
        title={s.homeShowcaseTitle}
        sub={s.homeShowcaseSub}
      />

      {/* Straight after the scrolling gallery: three ways into the shop, which
          answers "what else is there" faster than another product row. */}
      <BannerStrip banners={banners} />

      {limitedHero && (
        <LimitedEdition
          eyebrow={s.homeSpecialEyebrow}
          title={s.homeSpecialTitle}
          sub={s.homeSpecialSub}
          product={limitedHero}
          moreCount={limitedRest.length}
        />
      )}

      <ProductRow
        eyebrow={s.homePopularEyebrow}
        title={s.homePopularTitle}
        sub={s.homePopularSub}
        products={features.POPULAR}
      />

      <Story
        followers={num(s, "statFollowers") || 7500}
        productCount={num(s, "statProducts") || 124}
        photos={storyPhotos}
      />

      <ClubTeaser tiers={tiers} />

      <FeatureBand />

      <FinalCTA />
    </>
  );
}
