/**
 * Callers: Playwright `marketing` project.
 * API: /knowledge, /knowledge/[slug] ← articles (public RLS: is_published).
 * User: "מאמרים מובילים לדף שגיאה, והעיצוב לא משהו".
 */
import { expect, test } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

const RUN_ID = Date.now();
/** סלאג עברי, כמו שהעורך בניהול מייצר מהכותרת */
const SLUG = `בדיקת-מאמר-${RUN_ID}`;
const TITLE = `מאמר בדיקה ${RUN_ID}`;
const UNPUBLISHED_SLUG = `טיוטה-${RUN_ID}`;
/** תוקף הרשימה בקאש הוא דקה (cacheLife minutes) */
const LIST_REVALIDATE_TIMEOUT = 90_000;

test.describe("מרכז הידע ועמוד מאמר", () => {
  const articleIds: string[] = [];

  test.beforeAll(async () => {
    const service = createServiceClient();
    const { data, error } = await service
      .from("articles")
      .insert([
        {
          slug: SLUG,
          title: TITLE,
          excerpt: "תקציר המאמר לבדיקה",
          // התוכן כולל HTML זדוני: חייב להיות מנוקה לפני ההצגה
          content:
            '<h1>כותרת בתוך התוכן</h1><p>פסקה ראשונה</p><ul><li>פריט ברשימה</li></ul><blockquote><p>ציטוט</p></blockquote><script>window.__xss = true</script><img src="x" onerror="window.__xss = true">',
          category: "general",
          is_published: true,
          published_at: new Date().toISOString(),
        },
        {
          slug: UNPUBLISHED_SLUG,
          title: "טיוטה שאין להציג",
          excerpt: "טיוטה",
          content: "<p>טיוטה</p>",
          category: "general",
          is_published: false,
        },
      ])
      .select("id");
    expect(error).toBeNull();
    articleIds.push(...(data ?? []).map((row) => row.id as string));
  });

  test.afterAll(async () => {
    if (articleIds.length === 0) return;
    await createServiceClient().from("articles").delete().in("id", articleIds);
  });

  test("לחיצה על מאמר ברשימה פותחת את המאמר ולא דף שגיאה", async ({ page }) => {
    test.setTimeout(LIST_REVALIDATE_TIMEOUT + 30_000);

    // Act - המאמר נוסף ישירות ל-DB (בלי פעולת הניהול שמפקיעה את הקאש), ולכן אם
    // הרשימה נשמרה בקאש בדקה האחרונה היא מתרעננת רק בטעינה חוזרת
    const articleLink = page.getByRole("link", { name: new RegExp(TITLE) });
    await expect(async () => {
      await page.goto("/knowledge");
      await expect(articleLink).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: LIST_REVALIDATE_TIMEOUT });
    await articleLink.click();

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: TITLE }),
    ).toBeVisible();
    await expect(page.getByText("פסקה ראשונה")).toBeVisible();
    await expect(page.getByText("פריט ברשימה")).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(TITLE));
  });

  test("כתובת עם סלאג עברי מקודד נטענת, ויש קישור חזרה למרכז הידע", async ({
    page,
  }) => {
    // Act
    await page.goto(`/knowledge/${encodeURIComponent(SLUG)}`);

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: TITLE }),
    ).toBeVisible();
    await page.getByRole("link", { name: "חזרה למרכז הידע" }).first().click();
    await expect(page).toHaveURL(/\/knowledge$/);
  });

  test("כותרת בתוך התוכן אינה h1 נוסף, וה-HTML הזדוני מנוקה", async ({
    page,
  }) => {
    // Act
    await page.goto(`/knowledge/${encodeURIComponent(SLUG)}`);
    await expect(
      page.getByRole("heading", { level: 1, name: TITLE }),
    ).toBeVisible();

    // Assert
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 2, name: "כותרת בתוך התוכן" }),
    ).toBeVisible();
    expect(await page.evaluate(() => "__xss" in window)).toBe(false);
    await expect(page.locator("article script")).toHaveCount(0);
    await expect(page.locator("article img[onerror]")).toHaveCount(0);
  });

  test("מאמר שלא קיים או לא פורסם מציג 404 עם noindex ולא קורס", async ({
    page,
  }) => {
    for (const slug of [`אין-כזה-${RUN_ID}`, UNPUBLISHED_SLUG]) {
      // Act
      await page.goto(`/knowledge/${encodeURIComponent(slug)}`);

      // Assert - תחת Cache Components התשובה כבר זורמת כ-200, ולכן ההגנה
      // מפני אינדוקס היא תג noindex ועמוד "לא נמצא", לא קוד סטטוס.
      await expect(page.getByText("הדף שחיפשת לא נמצא")).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });

  test("סינון לפי קטגוריה ללא תוצאות מציג מצב ריק", async ({ page }) => {
    // Act
    await page.goto("/knowledge?cat=shadchanim");

    // Assert — או כרטיסים, או הודעת "עוד לא פורסמו", אך לעולם לא שגיאה
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("אירעה שגיאה")).toHaveCount(0);
  });
});
