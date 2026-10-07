import { cacheLife, cacheTag } from "next/cache";
import sanitizeHtml from "sanitize-html";
import { ARTICLES_CACHE_TAG } from "@/lib/articles-cache";
import { createClient } from "@/lib/supabase/public";

/**
 * מאמרי מרכז הידע, עבור האתר התדמיתי (אינדקס, עמוד מאמר, מטא-דאטה).
 *
 * הקריאה היא אנונימית (בלי cookies): תוכן שמפורסם הוא ציבורי, ובלי cookies
 * אפשר להטמיע אותו בקאש. קודם הקריאה עברה דרך לקוח השרת שקורא cookies גם
 * מתוך generateMetadata, מה שמסומן כשגיאה תחת Cache Components.
 */

export const ARTICLE_CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

export type PublishedArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string | null;
  read_time_minutes: number | null;
  published_at: string | null;
};

export type ArticleSummary = Pick<
  PublishedArticle,
  | "id"
  | "slug"
  | "title"
  | "excerpt"
  | "category"
  | "cover_image_url"
  | "read_time_minutes"
  | "published_at"
>;

const SUMMARY_COLUMNS =
  "id, slug, title, excerpt, category, cover_image_url, read_time_minutes, published_at";

/** מספר המאמרים הקשורים שמוצגים בתחתית מאמר */
const RELATED_ARTICLES_LIMIT = 3;

/** הקישור לעמוד מאמר. סלאג עברי מקודד, כדי שלא יישבר בתווים מיוחדים */
export function articleHref(slug: string): string {
  return `/knowledge/${encodeURIComponent(slug)}`;
}

/**
 * הסלאג עשוי להגיע מהנתיב כשהוא מקודד (%D7%...); בעמודי המאמרים הוא נשמר
 * בבסיס הנתונים כעברית רגילה, ולכן מפענחים לפני החיפוש.
 */
export function normalizeSlug(rawSlug: string): string {
  if (!rawSlug.includes("%")) return rawSlug;
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

export function formatArticleDate(publishedAt: string | null): string {
  if (!publishedAt) return "";
  return new Date(publishedAt).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatReadTime(minutes: number | null): string {
  return `${minutes ?? 5} דק׳ קריאה`;
}

/** מאמר מפורסם לפי סלאג, או null כשאין. שגיאת שאילתה נזרקת (ואינה נשמרת בקאש) */
export async function getPublishedArticle(
  rawSlug: string,
): Promise<PublishedArticle | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_CACHE_TAG);

  const { data, error } = await createClient()
    .from("articles")
    .select(`${SUMMARY_COLUMNS}, content`)
    .eq("slug", normalizeSlug(rawSlug))
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("[articles] טעינת המאמר נכשלה", error);
    throw new Error("ARTICLE_FETCH_FAILED");
  }

  return data;
}

/** מאמרים מפורסמים, אפשר לסנן לפי קטגוריה */
export async function listPublishedArticles(
  category: string,
): Promise<ArticleSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_CACHE_TAG);

  let query = createClient()
    .from("articles")
    .select(SUMMARY_COLUMNS)
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) {
    console.error("[articles] טעינת רשימת המאמרים נכשלה", error);
    throw new Error("ARTICLES_FETCH_FAILED");
  }

  return data ?? [];
}

/** מאמרים נוספים להמשך קריאה: אותה קטגוריה קודם, ואז החדשים ביותר */
export async function listRelatedArticles(
  current: Pick<PublishedArticle, "id" | "category">,
): Promise<ArticleSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_CACHE_TAG);

  const { data, error } = await createClient()
    .from("articles")
    .select(SUMMARY_COLUMNS)
    .eq("is_published", true)
    .neq("id", current.id)
    .order("published_at", { ascending: false })
    .limit(RELATED_ARTICLES_LIMIT * 4);

  if (error) {
    console.error("[articles] טעינת מאמרים קשורים נכשלה", error);
    return [];
  }

  const sameCategory = (data ?? []).filter(
    (a) => a.category === current.category,
  );
  const others = (data ?? []).filter((a) => a.category !== current.category);
  return [...sameCategory, ...others].slice(0, RELATED_ARTICLES_LIMIT);
}

const ALLOWED_PROTOCOLS = ["http", "https", "mailto", "tel"];

/**
 * ניקוי ה-HTML של עורך הטקסט העשיר (TipTap) לפני הצגתו בעמוד ציבורי.
 * רשימה לבנה בלבד: אין script/style/iframe ואין מאפייני אירועים. כותרת
 * ה-h1 של המאמר היא כותרת העמוד, ולכן h1 בתוכן מונמך ל-h2 כדי לשמור על
 * היררכיית כותרות תקינה. קישורים חיצוניים נפתחים עם noopener.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "hr",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "code",
      "pre",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ALLOWED_PROTOCOLS,
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        const isExternal = /^https?:/i.test(attribs.href ?? "");
        return {
          tagName,
          attribs: isExternal
            ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
            : attribs,
        };
      },
    },
  });
}
