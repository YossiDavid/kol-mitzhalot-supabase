import type { MetadataRoute } from "next";

import { getAppOrigin } from "@/lib/app-url";
import { listPublishedArticles } from "@/lib/articles";

/**
 * sitemap.xml לגוגל: עמודי האתר הציבורי, עמודי המדיניות ומאמרי מרכז הידע
 * המפורסמים. כשל בטעינת המאמרים לא מפיל את המפה - העמודים הקבועים נשארים.
 */

const STATIC_PATHS: readonly {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/shadchanim", priority: 0.8, changeFrequency: "monthly" },
  { path: "/parents", priority: 0.8, changeFrequency: "monthly" },
  { path: "/whats-new", priority: 0.7, changeFrequency: "daily" },
  { path: "/knowledge", priority: 0.7, changeFrequency: "weekly" },
  { path: "/endorsements", priority: 0.6, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
  { path: "/donations", priority: 0.6, changeFrequency: "monthly" },
  { path: "/support", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/legal/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/accessibility", priority: 0.3, changeFrequency: "yearly" },
];

async function articleEntries(origin: string): Promise<MetadataRoute.Sitemap> {
  try {
    const articles = await listPublishedArticles("");
    return articles.map((article) => ({
      url: `${origin}/knowledge/${encodeURIComponent(article.slug)}`,
      lastModified: article.published_at ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch (error) {
    console.error("[sitemap] טעינת המאמרים נכשלה", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getAppOrigin();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(
    ({ path, priority, changeFrequency }) => ({
      url: `${origin}${path}`,
      changeFrequency,
      priority,
    }),
  );
  return [...staticEntries, ...(await articleEntries(origin))];
}
