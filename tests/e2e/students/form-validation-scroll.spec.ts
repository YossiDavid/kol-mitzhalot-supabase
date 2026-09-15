import { test, expect } from "@playwright/test";

/**
 * "המשך לשלב הבא" עם שדות חובה ריקים: הדף גולל אל השדה השגוי הראשון ומעביר
 * אליו פוקוס, גם כשהמשתמש נמצא בתחתית השלב והשגיאה הראשונה מעל המסך.
 */

const VIEWPORTS = [
  { name: "דסקטופ", width: 1280, height: 600 },
  { name: "מובייל", width: 390, height: 700 },
];

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: הבא עם שדות חסרים מעביר פוקוס לשדה השגוי הראשון`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/app/students/create");
    await page.getByRole("radio", { name: "מיועד", exact: true }).check();
    const nextButton = page.getByRole("button", { name: "המשך לשלב הבא" });
    await nextButton.click();

    const stepHeading = page.getByRole("heading", { name: "פרטים אישיים" });
    await expect(stepHeading).toBeVisible();
    const firstName = page.locator("#firstName");
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(firstName).not.toBeInViewport();

    // Act
    await nextButton.click();

    // Assert
    await expect(firstName).toBeFocused();
    await expect(firstName).toHaveAttribute("aria-invalid", "true");
    await expect(firstName).toBeInViewport();
    await expect(stepHeading).toBeVisible();
  });
}
