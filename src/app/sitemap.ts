import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const base = () =>
  (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { active: true }, select: { slug: true, createdAt: true } }),
    db.category.findMany({ select: { slug: true } }),
  ]);

  const staticPages = ["", "/products", "/about", "/contact", "/club"].map((p) => ({
    url: `${base()}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.8,
  }));

  return [
    ...staticPages,
    ...categories.map((c) => ({
      url: `${base()}/products?cat=${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base()}/products/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
