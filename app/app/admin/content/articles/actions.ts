"use server";

/**
 * Callers: מסכי עריכת המאמרים בניהול (שמירה, פרסום, מחיקה).
 * הכתיבה למאמרים נעשית מהדפדפן ישירות ל-Supabase, ולכן אחריה נקראת הפעולה
 * הזו: היא מפקיעה מיד את קאש האתר התדמיתי (ARTICLES_CACHE_TAG), כדי שמאמר
 * שפורסם יופיע באתר מיד ולא רק בתום תוקף הקאש.
 */

import { updateTag } from "next/cache";

import { ARTICLES_CACHE_TAG } from "@/lib/articles-cache";
import { getUser, hasRole } from "@/lib/user";

export async function refreshArticlesCache(): Promise<void> {
  const user = await getUser();
  if (!user || !hasRole(user, "admin")) {
    throw new Error("אין הרשאה");
  }
  updateTag(ARTICLES_CACHE_TAG);
}
