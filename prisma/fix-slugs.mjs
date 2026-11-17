import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

/**
 * Give every product an ASCII slug (category-N). Persian slugs 404 because
 * Next.js normalizes the URL path to a different Unicode form than what is
 * stored, so findUnique never matches. ASCII sidesteps the whole problem.
 * Runs in place - images, gallery and orders are untouched.
 */
async function main() {
  const cats = Object.fromEntries((await db.category.findMany()).map((c) => [c.id, c.slug]));
  const products = await db.product.findMany({ orderBy: { createdAt: "asc" } });

  const counter = {};
  const used = new Set();
  let changed = 0;

  for (const p of products) {
    const base = cats[p.categoryId] || "product";
    counter[base] = (counter[base] || 0) + 1;
    let slug = `${base}-${counter[base]}`;
    while (used.has(slug)) slug = `${base}-${++counter[base]}`;
    used.add(slug);
    if (p.slug !== slug) {
      await db.product.update({ where: { id: p.id }, data: { slug } });
      changed++;
    }
  }
  console.log(`slugs normalized to ASCII: ${changed} updated`);
  const sample = await db.product.findMany({ take: 5, select: { slug: true, nameFa: true } });
  sample.forEach((s) => console.log(`  ${s.slug}  ← ${s.nameFa}`));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
