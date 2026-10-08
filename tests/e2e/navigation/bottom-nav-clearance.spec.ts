import { expect, test } from "@playwright/test";

/**
 * הסרגל התחתון במובייל: אטום, תוויות בשורה אחת, ותוכן הדף נגלל עד סופו בלי
 * להיות מוסתר מתחתיו (הרווח התחתון של ה-main גדול מגובה הסרגל).
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const LOAD_TIMEOUT = 15_000;

test.use({ viewport: MOBILE_VIEWPORT });

test("התוכן האחרון בדף נגלל מעל הסרגל התחתון", async ({ page }) => {
  // Arrange
  await page.goto("/app/canvas");
  const nav = page.locator("nav.fixed.bottom-0");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });
  const lastControl = page.locator("main").getByRole("button").last();
  await expect(lastControl).toBeVisible({ timeout: LOAD_TIMEOUT });

  // Act
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(300);

  // Assert - הרכיב האחרון נמצא כולו מעל החלק העליון של הסרגל
  const navBox = await nav.boundingBox();
  const controlBox = await lastControl.boundingBox();
  if (!navBox || !controlBox) throw new Error("חסרים מיקומים");
  expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(navBox.y);
});

test("הסרגל אטום ותוויות הפריטים בשורה אחת", async ({ page }) => {
  // Arrange
  await page.goto("/app");
  const nav = page.locator("nav.fixed.bottom-0");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });

  // Assert - רקע אטום (אלפא 1)
  const background = await nav.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(background).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)$/);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");

  // Assert - כל תווית בשורה אחת (גובה שורה אחת בלבד)
  const heights = await nav
    .locator("a span.whitespace-nowrap")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeLessThan(20);
});
