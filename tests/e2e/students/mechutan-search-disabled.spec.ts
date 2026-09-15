import { test, expect } from "@playwright/test";

/**
 * חיפוש המחותנים במאגר מושבת (hidden: true ב-family-step.ts) ונשמר לשימוש
 * עתידי: בשורת מחותן אין בורר חיפוש, פרטי המחותן נשארים פתוחים להזנה ידנית,
 * ואין פנייה ל-/users/mechutanim שאינו קיים.
 */
test("שורת מחותן: בלי חיפוש במאגר, והשדות פתוחים להזנה ידנית", async ({
  page,
}) => {
  // Arrange
  const mechutanimRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/users/mechutanim")) {
      mechutanimRequests.push(request.url());
    }
  });
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "מיועד", exact: true }).check();
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: "על המשפחה", exact: true })
    .click();

  // Act
  await page.getByRole("button", { name: "הוספת מחותן" }).click();

  // Assert
  const firstName = page.locator(
    '[data-field-name="family.mechutanim.0.firstName"]',
  );
  await expect(firstName).toBeVisible();
  await expect(firstName.getByRole("textbox")).toBeEnabled();
  await expect(
    page
      .locator('[data-field-name="family.mechutanim.0.lastName"]')
      .getByRole("textbox"),
  ).toBeEnabled();
  await expect(
    page.locator('[data-field-name="family.mechutanim.0.id"]'),
  ).toHaveCount(0);
  await expect(page.getByText("לבחירה מתוך המאגר")).toHaveCount(0);
  expect(mechutanimRequests).toEqual([]);
});
