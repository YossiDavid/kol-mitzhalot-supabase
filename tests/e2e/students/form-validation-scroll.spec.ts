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

/**
 * הודעת שדה חובה נבנית מהתווית שמוצגת ומסוג הפקד (create-form/field-messages.ts):
 * "נא למלא" לשדה הקלדה, "נא לבחור" לרשימה - ולא "שדה חובה" כללי.
 */
test("הודעות שדה חובה ספציפיות לפי תווית וסוג פקד", async ({ page }) => {
  // Arrange
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "מיועדת", exact: true }).check();
  const nextButton = page.getByRole("button", { name: "המשך לשלב הבא" });
  await nextButton.click();
  await expect(
    page.getByRole("heading", { name: "פרטים אישיים" }),
  ).toBeVisible();

  // Act
  await nextButton.click();

  // Assert
  const houseCell = page.locator('[data-field-name="house"]');
  await expect(houseCell.getByText("נא למלא מספר בית")).toBeVisible();
  const cellphoneCell = page.locator('[data-field-name="cellphoneType"]');
  await expect(
    cellphoneCell.getByText("נא לבחור סוג טלפון נייד"),
  ).toBeVisible();
  await expect(page.getByText("שדה חובה", { exact: true })).toHaveCount(0);
});

test("שם עם תוארים מקבל הודעה עם התווית המגדרית", async ({ page }) => {
  // Arrange
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "מיועדת", exact: true }).check();
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: "על המשפחה", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "על המשפחה" })).toBeVisible();

  // Act
  await page.getByRole("button", { name: "המשך לשלב הבא" }).click();

  // Assert
  const fatherCell = page.locator('[data-field-name="father.self"]');
  await expect(fatherCell.getByText("נא למלא שם אביה")).toBeVisible();
  await expect(page.locator("#father-self")).toBeFocused();
});
