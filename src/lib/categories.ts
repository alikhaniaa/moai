import { db } from "./db";

/**
 * Categories are two levels deep: a parent groups leaves, and a product always
 * hangs off a leaf. A parent's shop page therefore lists everything under its
 * children, and old `?cat=<slug>` links keep working because the leaves kept
 * the slugs they always had.
 */

export type CategoryNode = {
  id: string;
  slug: string;
  nameFa: string;
  image: string | null;
  sort: number;
  children: {
    id: string; slug: string; nameFa: string; image: string | null; sort: number;
  }[];
};

/** The active tree, parents in `sort` order with their active children. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const all = await db.category.findMany({
    where: { active: true },
    orderBy: { sort: "asc" },
  });

  const byParent = new Map<string, typeof all>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  return all
    .filter((c) => !c.parentId)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      nameFa: c.nameFa,
      image: c.image,
      sort: c.sort,
      children: (byParent.get(c.id) ?? []).map((k) => ({
        id: k.id, slug: k.slug, nameFa: k.nameFa, image: k.image, sort: k.sort,
      })),
    }));
}

/**
 * Every category id a `?cat=<slug>` filter should match: the category itself
 * plus its children, so a parent page shows the whole group.
 */
export async function categoryIdsForSlug(slug: string): Promise<string[] | null> {
  const cat = await db.category.findUnique({
    where: { slug },
    include: { children: { where: { active: true } } },
  });
  if (!cat) return null;
  return [cat.id, ...cat.children.map((c) => c.id)];
}

/** Only leaves can hold products, so only leaves are offered in the admin form. */
export async function getLeafCategories() {
  const all = await db.category.findMany({ orderBy: { sort: "asc" } });
  const parentIds = new Set(all.map((c) => c.parentId).filter(Boolean));
  const byId = new Map(all.map((c) => [c.id, c]));

  return all
    .filter((c) => !parentIds.has(c.id))
    .map((c) => {
      const parent = c.parentId ? byId.get(c.parentId) : null;
      // parent name is prefixed so «کلاه» and «کیف و ارگانایزر» read in context
      return { ...c, nameFa: parent ? `${parent.nameFa} › ${c.nameFa}` : c.nameFa };
    });
}
