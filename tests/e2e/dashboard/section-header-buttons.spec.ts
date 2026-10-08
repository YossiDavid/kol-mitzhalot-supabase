import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * כפתור "לכל ה..." בכותרת מקטע בלוח הבקרה מוצג רק כשיש במקטע נתונים. מקטע
 * ריק מציג רק את הכפתור שבתוך תיבת המצב הריק (אחרת היו שני כפתורים כהים),
 * וכפתורי הכותרת הם outline - הכפתורים הכהים בלוח הם פעולות אמיתיות.
 */
const LOAD_TIMEOUT = 15_000;

type SectionSpec = {
  heading: string;
  /** כותרת תיבת המצב הריק של המקטע */
  emptyTitle: string;
  headerLink: string;
};

const SECTIONS: readonly SectionSpec[] = [
  {
    heading: "המועדפים שלך",
    emptyTitle: "עוד לא הוספת שמות מועדפים ללוח העבודה",
    headerLink: "ללוח העבודה",
  },
  {
    heading: "פורום השדכנים",
    emptyTitle: "עדיין אין הודעות בפורום השדכנים",
    headerLink: "לפורום השדכנים",
  },
];

function sectionOf(page: Page, heading: string): Locator {
  // המקטע הפנימי ביותר: האזור ("כלי שדכן") עטוף גם הוא ב-section
  return page
    .locator("section:not(:has(section))")
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

test.describe("כפתורי כותרת במקטעי לוח הבקרה", () => {
  for (const { heading, emptyTitle, headerLink } of SECTIONS) {
    test(`${heading}: כפתור הכותרת מוצג רק כשיש נתונים`, async ({ page }) => {
      // Arrange
      await page.goto("/app");
      const section = sectionOf(page, heading);
      await expect(section).toBeVisible({ timeout: LOAD_TIMEOUT });
      await expect(section.getByRole("status")).toHaveCount(0, {
        timeout: LOAD_TIMEOUT,
      });

      // Act
      const isEmpty = (await section.getByText(emptyTitle).count()) > 0;
      const header = section.locator("> div").first();

      // Assert
      if (isEmpty) {
        await expect(header.getByRole("link")).toHaveCount(0);
        await expect(section.getByRole("link")).toHaveCount(1);
      } else {
        const link = header.getByRole("link", { name: headerLink });
        await expect(link).toBeVisible();
        // כפתור ניווט, לא פעולה: outline ולא רקע ראשי
        await expect(link).not.toHaveClass(/bg-primary(\s|$)/);
      }
    });
  }

  test("מקטע הכרטיסים שומר את כפתור ההוספה בכותרת", async ({ page }) => {
    // Arrange
    await page.goto("/app");

    // Assert
    const section = page
      .locator("section:not(:has(section))")
      .filter({ has: page.getByRole("link", { name: "להוספת מיועד/ת" }) })
      .first();
    await expect(
      section.locator("> div").first().getByRole("link", {
        name: "להוספת מיועד/ת",
      }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});
