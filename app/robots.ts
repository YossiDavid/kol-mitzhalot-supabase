import type { MetadataRoute } from "next";

import { getAppOrigin } from "@/lib/app-url";

/**
 * robots.txt: האתר הציבורי פתוח לסריקה; המערכת (/app), ההתחברות, ה-API
 * ועמודי הפיתוח סגורים. בסביבות שאינן production (preview של Vercel)
 * הכול סגור, כדי שגוגל לא יאנדקס עותקים כפולים של האתר.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();
  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/auth", "/api", "/dev"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
