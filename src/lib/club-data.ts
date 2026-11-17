import { db } from "./db";
import { getSettings, num } from "./settings";
import { DEFAULT_TIERS, TIER_COLORS, type Tier } from "./club";

/** Club tiers from the DB (admin-editable). Falls back to the built-in defaults
 *  when the table is empty, so the club is never blank. */
export async function getClubTiers(): Promise<Tier[]> {
  const rows = await db.clubTier.findMany({ orderBy: { minPoints: "asc" } });
  if (rows.length === 0) return DEFAULT_TIERS;
  return rows.map((r, i) => ({
    key: r.key,
    nameFa: r.nameFa,
    emoji: r.emoji,
    min: r.minPoints,
    color: TIER_COLORS[i % TIER_COLORS.length],
    perks: r.perks.split("\n").map((p) => p.trim()).filter(Boolean),
  }));
}

/** Functional club numbers (kept in Setting, independent of tier display). */
export async function getClubConfig() {
  const s = await getSettings();
  return {
    welcomePoints: num(s, "clubWelcomePoints") || 50,
    pointsPer100k: num(s, "clubPointsPer100k") || 10,
  };
}
