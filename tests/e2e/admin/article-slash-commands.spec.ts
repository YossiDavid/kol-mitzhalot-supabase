/**
 * Callers: Playwright `chromium-admin` project.
 * API: /app/admin/content/articles/new (RichTextEditor + תפריט "/"),
 *      /knowledge/[slug] (sanitizeArticleHtml), storage bucket `content`.
 * User: "צריך להוסיף במאמרים תמיכה ב slash commands".
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

const RUN_ID = Date.now();
const TITLE = `מאמר פקודות ${RUN_ID}`;
const EXCERPT = "תקציר מאמר בדיקת פקודות";
const NEW_ARTICLE_URL = "/app/admin/content/articles/new";
const PUBLISH_TIMEOUT = 30_000;
/** PNG של פיקסל אחד, להעלאה אמיתית ל-bucket `content` */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function editorOf(page: Page): Locator {
  return page.locator('[aria-label="עורך תוכן"]');
}

function menuOf(page: Page): Locator {
  return page.getByRole("listbox", { name: "פקודות עיצוב" });
}

async function openNewArticle(page: Page): Promise<Locator> {
  await page.goto(NEW_ARTICLE_URL);
  const editor = editorOf(page);
  await expect(editor).toBeVisible();
  await editor.click();
  return editor;
}

test.describe("עורך המאמרים: פקודות /", () => {
  test("הקלדת / פותחת תפריט, והקלדה ממשיכה לסנן אותו", async ({ page }) => {
    // Arrange
    const editor = await openNewArticle(page);
    await expect(page.getByText("הקלידו / לפקודות")).toBeVisible();

    // Act + Assert - פתיחה
    await page.keyboard.type("/");
    await expect(menuOf(page).getByRole("option")).toHaveCount(10);

    // Act + Assert - סינון בעברית
    await page.keyboard.type("כותרת");
    await expect(menuOf(page).getByRole("option")).toHaveCount(3);
    await expect(
      menuOf(page).getByRole("option", { name: /כותרת גדולה/ }),
    ).toBeVisible();

    // Act + Assert - סינון באנגלית (מחיקת הטקסט וניסוח מחדש)
    for (let i = 0; i < "כותרת".length; i++)
      await page.keyboard.press("Backspace");
    await page.keyboard.type("h2");
    await expect(menuOf(page).getByRole("option")).toHaveCount(1);
    await expect(
      menuOf(page).getByRole("option", { name: /כותרת גדולה/ }),
    ).toBeVisible();

    for (let i = 0; i < 2; i++) await page.keyboard.press("Backspace");
    await page.keyboard.type("list");
    await expect(menuOf(page).getByRole("option")).toHaveCount(2);

    // Assert - בלי תוצאות
    await page.keyboard.type("zzz");
    await expect(page.getByText("לא נמצאו פקודות").first()).toBeVisible();
    await expect(editor).toContainText("/listzzz");
  });

  test("התפריט נפתח אחרי רווח אבל לא באמצע מילה", async ({ page }) => {
    // Arrange
    await openNewArticle(page);

    // Act + Assert - באמצע מילה
    await page.keyboard.type("a/b");
    await expect(menuOf(page)).toHaveCount(0);

    // Act + Assert - אחרי רווח
    await page.keyboard.type(" /h3");
    await expect(menuOf(page).getByRole("option")).toHaveCount(1);
  });

  test("ניווט במקלדת ו-Enter מכניסים כותרת ומסירים את טקסט הפקודה", async ({
    page,
  }) => {
    // Arrange
    const editor = await openNewArticle(page);
    await page.keyboard.type("/כותרת");
    const options = menuOf(page).getByRole("option");

    // Act - למטה ולמעלה, חזרה לפריט הראשון
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(editor).toHaveAttribute(
      "aria-activedescendant",
      (await options.nth(1).getAttribute("id")) ?? "",
    );
    await page.keyboard.press("ArrowUp");
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");

    // Assert
    await expect(editor.locator("h2")).toHaveCount(1);
    await expect(editor).not.toContainText("/");
    await expect(menuOf(page)).toHaveCount(0);

    // Act + Assert - Tab מחיל את הפריט הפעיל (כותרת בינונית)
    await page.keyboard.type("טקסט");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/h3");
    await page.keyboard.press("Tab");
    await expect(editor.locator("h3")).toHaveCount(1);
    await expect(editor).not.toContainText("/h3");
  });

  test("לחיצה על פקודה מכניסה ציטוט, ו-Esc סוגר בלי להכניס דבר", async ({
    page,
  }) => {
    // Arrange
    const editor = await openNewArticle(page);

    // Act + Assert - לחיצה
    await page.keyboard.type("/ציטוט");
    await menuOf(page).getByRole("option", { name: /ציטוט/ }).click();
    await expect(editor.locator("blockquote")).toHaveCount(1);
    await expect(editor).not.toContainText("/ציטוט");

    // Act + Assert - Esc
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/h2");
    await expect(menuOf(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menuOf(page)).toHaveCount(0);
    await expect(editor.locator("h2")).toHaveCount(0);
    await expect(editor).toContainText("/h2");
  });

  test("התפריט נשאר בתוך המסך גם בחלון צר", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 360, height: 640 });
    await openNewArticle(page);

    // Act
    await page.keyboard.type("/");
    // המסגרת הנגללת של התפריט (ה-listbox עצמו ארוך ממנה)
    const box = await menuOf(page).locator("..").boundingBox();

    // Assert
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  });

  test.describe("שמירה ופרסום", () => {
    let articleId: string | null = null;
    let imagePath: string | null = null;

    test.afterAll(async () => {
      const service = createServiceClient();
      if (articleId)
        await service.from("articles").delete().eq("id", articleId);
      if (imagePath) await service.storage.from("content").remove([imagePath]);
    });

    test("כל מה שהפקודות מכניסות מוצג באתר הציבורי", async ({ page }) => {
      test.setTimeout(90_000);

      // Arrange
      const editor = await openNewArticle(page);
      await page.getByPlaceholder("כותרת המאמר").fill(TITLE);
      await page
        .getByPlaceholder("תקציר קצר שיופיע בכרטיס המאמר")
        .fill(EXCERPT);
      await editor.click();

      // Act - כותרת, רשימה, ציטוט, קו מפריד
      await page.keyboard.type("/h2");
      await page.keyboard.press("Enter");
      await page.keyboard.type("כותרת גדולה לבדיקה");
      await page.keyboard.press("Enter");

      await page.keyboard.type("/list");
      await page.keyboard.press("Enter");
      await page.keyboard.type("פריט ראשון ברשימה");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");

      await page.keyboard.type("/ציטוט");
      await page.keyboard.press("Enter");
      await page.keyboard.type("טקסט הציטוט לבדיקה");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");

      await page.keyboard.type("/קו");
      await page.keyboard.press("Enter");

      await page.keyboard.type("/h4");
      await page.keyboard.press("Enter");
      await page.keyboard.type("כותרת קטנה לבדיקה");
      await page.keyboard.press("Enter");

      // Act - קישור
      await page.keyboard.type("/קישור");
      await page.keyboard.press("Enter");
      await page.getByLabel("כתובת הקישור").fill("example.com/page");
      await page.getByLabel("טקסט הקישור (לא חובה)").fill("קישור לבדיקה");
      await page.getByRole("button", { name: "הוספה" }).click();
      await expect(
        editor.locator('a[href="https://example.com/page"]'),
      ).toHaveText("קישור לבדיקה");
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");

      // Act - תמונה (העלאה אמיתית ל-bucket)
      await page.keyboard.type("/תמונה");
      await page.keyboard.press("Enter");
      await page.getByLabel("קובץ תמונה").setInputFiles({
        name: "pixel.png",
        mimeType: "image/png",
        buffer: PIXEL_PNG,
      });
      await page.getByRole("button", { name: "הוספה" }).click();
      await expect(page.getByText("יש להזין תיאור לתמונה")).toBeVisible();
      await page.getByLabel("תיאור התמונה (חובה)").fill("פיקסל לבדיקה");
      await page.getByRole("button", { name: "הוספה" }).click();
      await expect(editor.locator('img[alt="פיקסל לבדיקה"]')).toHaveCount(1);

      // Act - פרסום
      await page.getByRole("button", { name: "פרסם", exact: true }).click();
      await page.waitForURL(/\/app\/admin\/content\/articles\/[0-9a-f-]{36}$/, {
        timeout: PUBLISH_TIMEOUT,
      });

      const { data, error } = await createServiceClient()
        .from("articles")
        .select("id, slug, content")
        .eq("title", TITLE)
        .single();
      expect(error).toBeNull();
      articleId = data?.id ?? null;
      imagePath =
        /\/storage\/v1\/object\/public\/content\/([^"]+)"/.exec(
          data?.content ?? "",
        )?.[1] ?? null;

      await page.goto(`/knowledge/${encodeURIComponent(data!.slug)}`);

      // Assert - ברירת המחדל של העורך: נשמרו h2/h4, רשימה, ציטוט, קו, קישור
      const body = page.locator("article");
      await expect(
        body.getByRole("heading", { level: 2, name: "כותרת גדולה לבדיקה" }),
      ).toBeVisible();
      await expect(
        body.getByRole("heading", { level: 4, name: "כותרת קטנה לבדיקה" }),
      ).toBeVisible();
      await expect(
        body.getByRole("listitem").filter({ hasText: "פריט ראשון ברשימה" }),
      ).toBeVisible();
      await expect(
        body.locator("blockquote", { hasText: "טקסט הציטוט לבדיקה" }),
      ).toBeVisible();
      await expect(body.locator("hr")).toHaveCount(1);
      await expect(
        body.getByRole("link", { name: "קישור לבדיקה" }),
      ).toHaveAttribute("href", "https://example.com/page");

      // Assert - התמונה שהועלתה נשמרה בניקוי וגם נטענת
      const image = body.getByRole("img", { name: "פיקסל לבדיקה" });
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    });
  });
});
