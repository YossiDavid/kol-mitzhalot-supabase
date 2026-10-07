import { test, expect } from "@playwright/test";

/**
 * "לאתר קול מצהלות": קישור בולט מתוך המערכת אל האתר הציבורי, בכל גודל מסך -
 * בהדר ובסרגל הצד בדסקטופ, ובתפריט המשתמש במובייל (בלי לשבור את ההדר ב-360px).
 */
const SITE_LINK_NAME = "לאתר קול מצהלות";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 360, height: 740 };
const LOAD_TIMEOUT = 15_000;

test.describe("קישור לאתר הציבורי", () => {
  test("בדסקטופ: בהדר ובסרגל הצד, והלחיצה מובילה לדף הבית", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/app");

    // Assert
    const headerLink = page.getByTestId("header-site-link");
    await expect(headerLink).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(headerLink).toHaveAttribute("href", "/");
    await expect(headerLink).toHaveAccessibleName(SITE_LINK_NAME);
    await expect(page.getByTestId("sidebar-site-link")).toBeVisible();

    // Act
    await headerLink.click();

    // Assert
    await expect(page).toHaveURL(/\/$/);
  });

  test("במובייל: בתפריט המשתמש, וההדר לא גולש ברוחב 360", async ({ page }) => {
    // Arrange
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/app");
    await expect(page.getByTitle("תפריט משתמש")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });

    // Assert - בהדר עצמו אין קישור (אין מקום), ואין גלילה אופקית
    await expect(page.getByTestId("header-site-link")).toBeHidden();
    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    // Act
    await page.getByTitle("תפריט משתמש").click();

    // Assert
    const menuLink = page.getByRole("menuitem", { name: SITE_LINK_NAME });
    await expect(menuLink).toBeVisible();
    await expect(menuLink).toHaveAttribute("href", "/");
  });
});
