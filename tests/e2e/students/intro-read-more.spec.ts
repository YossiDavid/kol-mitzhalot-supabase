import { expect, test } from "@playwright/test";

/**
 * שלב ההקדמה בטופס הכרטיס: הפתיח מקוצר עם "קראו עוד" (הניסוח המלא נשאר
 * ב-DOM ונחשף בלחיצה), וההנחיה "למי מיועד הכרטיס" תמיד גלויה.
 */
const LOAD_TIMEOUT = 15_000;
const ALWAYS_VISIBLE_TEXT = "על מנת שנוכל להכיר אתכם לעומק";
const COLLAPSED_TEXT = "המידע שתמלאו ישמר בפרטיות מוחלטת";
const GUIDANCE_TITLE = "לפני שממלאים: למי מיועד הכרטיס";

test("קראו עוד חושף את שאר הפתיח וסוגר אותו שוב", async ({ page }) => {
  // Arrange
  await page.goto("/app/students/create");
  const toggle = page.getByRole("button", { name: "קראו עוד" });
  await expect(toggle).toBeVisible({ timeout: LOAD_TIMEOUT });

  // Assert - מקופל כברירת מחדל; ההוראה וההנחיה גלויות
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(ALWAYS_VISIBLE_TEXT)).toBeVisible();
  await expect(page.getByText(GUIDANCE_TITLE)).toBeVisible();
  await expect(page.getByText(COLLAPSED_TEXT)).toBeHidden();
  const controlledId = await toggle.getAttribute("aria-controls");
  expect(controlledId).toBeTruthy();
  await expect(page.locator(`[id="${controlledId}"]`)).toHaveCount(1);

  // Act
  await toggle.click();

  // Assert
  const lessToggle = page.getByRole("button", { name: "הצג פחות" });
  await expect(lessToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(COLLAPSED_TEXT)).toBeVisible();

  // Act
  await lessToggle.click();

  // Assert
  await expect(page.getByRole("button", { name: "קראו עוד" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByText(COLLAPSED_TEXT)).toBeHidden();
});
