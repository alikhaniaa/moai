/**
 * Puts the two «قصه ما» collage photos into the banners table, so the shop can
 * swap them from پنل مدیریت → بنرها instead of asking a developer.
 *
 *   node prisma/seed-story-banners.mjs
 *
 * Idempotent: if the STORY slot already has rows it leaves them alone, so this
 * can be re-run after any deploy without overwriting the shop's own photos.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const SLOT = "STORY";

// same photos and caption the section shipped with - the code falls back to
// these anyway, so seeding them changes nothing visually on day one
const ROWS = [
  { title: "ساحل آرام", subtitle: null, image: "/images/shore.jpg", sort: 0 },
  { title: "بافت پارچه نخی", subtitle: "بافتِ نرمِ پنبه", image: "/images/stripes.jpg", sort: 1 },
];

try {
  const existing = await db.banner.count({ where: { slot: SLOT } });
  if (existing > 0) {
    console.log(`· «قصه ما» already has ${existing} photo row(s) — left untouched`);
  } else {
    for (const row of ROWS) {
      await db.banner.create({ data: { ...row, slot: SLOT, active: true } });
    }
    console.log("✓ «قصه ما» photos added to بنرها (۲ ردیف)");
  }
} catch (err) {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
