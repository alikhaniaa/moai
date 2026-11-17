/**
 * Give every category a real photo of its own.
 *
 *   node prisma/set-category-images.mjs
 *
 * The homepage tiles used to fall back to "any uploaded photo from this group",
 * which meant nobody could see or change what they were. This writes a chosen
 * photo onto each Category row instead, so the tiles are explicit and editable
 * at /admin/categories.
 *
 * Idempotent, and deliberately conservative: a category that already has an
 * uploaded photo is left alone, so a picture chosen in the admin panel is never
 * overwritten by a re-run.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * The photo each category should lead with, by product slug. Chosen by hand - 
 * a tile wants the shot that reads at a glance, which is not always the shot
 * that happens to be first in the category.
 */
const PICKS = {
  // top level
  tanpoosh: "bathrobe-1",       // the hooded robe, worn - reads instantly
  towels: "body-1",             // the big striped body towel
  mats: "beach-mat-1",          // the beach mat laid out
  kids: "poncho-1",             // child in a poncho
  accessory: "dyson-bag",       // the organiser bag

  // children
  poncho: "poncho-2",
  bathrobe: "bathrobe-2",
  kimono: "kimono-robe",
  body: "body-1",
  hand: "hand-2",
  kitchen: "kitchen-1",
  "beach-mat": "beach-mat-1",
  "waterproof-mat": "waterproof-mat-1",
  bags: "accessory-5",
  hats: "straw-hat",
  "bath-accessory": "accessory-4",
  "home-textile": "cotton-bedspread",
};

const categories = await db.category.findMany({
  orderBy: { sort: "asc" },
  include: { children: true },
});

let set = 0;
let kept = 0;

for (const c of categories) {
  if (c.image?.startsWith("/uploads/")) {
    console.log(`   · ${c.nameFa} — عکس اختصاصی دارد، دست نخورد`);
    kept++;
    continue;
  }

  let image = null;

  const pick = PICKS[c.slug];
  if (pick) {
    const p = await db.product.findUnique({ where: { slug: pick } });
    if (p?.image.startsWith("/uploads/")) image = p.image;
  }

  // fall back to any real photo from inside the group (children included)
  if (!image) {
    const ids = [c.id, ...c.children.map((k) => k.id)];
    const found = await db.product.findFirst({
      where: { active: true, image: { startsWith: "/uploads/" }, categoryId: { in: ids } },
      orderBy: { featured: "desc" },
    });
    image = found?.image ?? null;
  }

  if (!image) {
    console.log(`   ⚠ ${c.nameFa} — هیچ عکس محصولی پیدا نشد، عکس پیش‌فرض می‌ماند`);
    continue;
  }

  await db.category.update({ where: { id: c.id }, data: { image } });
  console.log(`   ✓ ${c.nameFa} → ${image}`);
  set++;
}

console.log(`\n✓ ${set} دسته عکس گرفت، ${kept} از قبل عکس داشت\n`);
await db.$disconnect();
