import type { MetadataRoute } from "next";

const base = () =>
  (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // nothing private or transactional should ever reach a search index
      disallow: ["/admin", "/api/", "/account", "/checkout", "/login"],
    },
    sitemap: `${base()}/sitemap.xml`,
  };
}
