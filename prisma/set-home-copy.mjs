/**
 * One-time: bring the home page's saved copy in line with the new layout.
 *
 * `SETTING_DEFS` defaults only apply when a key has no row of its own, and this
 * shop has saved rows for all of them - so the old «نسخه‌ی محدود» wording would
 * survive a deploy untouched, and the دسته‌بندی‌ها rows would sit in the table
 * for a section that no longer exists.
 *
 * Only rows that still hold the OLD text are rewritten: anything the shop has
 * since typed herself is left exactly as it is.
 *
 *     node prisma/set-home-copy.mjs          # apply
 *     node prisma/set-home-copy.mjs --check  # show what would change
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const checkOnly = process.argv.includes("--check");

/** key → [the text we are replacing, the text it becomes] */
const REWRITE = {
  homeSpecialTitle: ["نسخه‌ی محدود", "نسخه محدود"],
  homeSpecialSub: [
    "دوخته‌شده در تیراژ کوتاه — وقتی تمام شد، دیگر همین طرح را نمی‌دوزیم.",
    "فقط چند عدد از هرکدام، نسخه محدود",
  ],
};

/** the دسته‌بندی‌ها section is gone from the page, so its copy has no home */
const DROP = ["homeCategoriesEyebrow", "homeCategoriesTitle", "homeCategoriesSub"];

for (const [key, [oldText, newText]] of Object.entries(REWRITE)) {
  const row = await db.setting.findUnique({ where: { key } });
  const current = row?.value ?? null;

  if (current === newText) {
    console.log(`  = ${key.padEnd(20)} already «${newText}»`);
    continue;
  }
  if (current !== null && current !== oldText) {
    console.log(`  ! ${key.padEnd(20)} left alone — the shop wrote her own: «${current.slice(0, 48)}»`);
    continue;
  }
  console.log(`  ${checkOnly ? "→" : "✓"} ${key.padEnd(20)} «${current ?? "(unset)"}» → «${newText}»`);
  if (!checkOnly) {
    await db.setting.upsert({ where: { key }, update: { value: newText }, create: { key, value: newText } });
  }
}

const present = await db.setting.findMany({ where: { key: { in: DROP } }, select: { key: true } });
if (present.length) {
  console.log(`\n  ${checkOnly ? "→" : "✓"} removing ${present.length} دسته‌بندی‌ها row(s): ${present.map((r) => r.key).join(", ")}`);
  if (!checkOnly) await db.setting.deleteMany({ where: { key: { in: DROP } } });
} else {
  console.log("\n  = no دسته‌بندی‌ها rows left to remove");
}

console.log(checkOnly ? "\n(--check: nothing written)" : "\nhome copy is up to date");
await db.$disconnect();
