import { expect, test, type Page } from "@playwright/test";

/**
 * "חסר בגרושים תאריך גירושים": השדה קיים בכל שורת נישואים קודמים, אבל מוצג
 * רק כשאופן הפרידה הוא גירושין. לגרוש/ה אופן הפרידה נבחר מראש, ולכן תאריך
 * הגירושין מוצג מיד כשמוסיפים נישואים קודמים (לאלמן/ה - פטירה).
 * הניווט בין השלבים בבורר הפיתוח (dev-skip-step-validation.spec.ts), כדי לא
 * למלא את כל השלבים שבדרך.
 */
const DEV_SWITCH = "מעבר בין שלבים בלי ולידציה (development בלבד)";

const stepsNav = (page: Page) =>
  page.getByRole("navigation", { name: "שלבי הטופס" });

async function addPreviousMarriage(page: Page, personalStatus: string) {
  await page.goto("/app/students/create");
  await page.getByRole("switch", { name: DEV_SWITCH }).click();
  await page.getByRole("radio", { name: "גבר", exact: true }).check();
  await stepsNav(page)
    .getByRole("button", { name: "פרטים אישיים", exact: true })
    .click();
  await page
    .locator('[data-field-name="personalStatus"] [data-slot="native-select"]')
    .selectOption(personalStatus);
  await stepsNav(page)
    .getByRole("button", { name: "פרטים נוספים", exact: true })
    .click();
  await page.getByRole("button", { name: "הוספת נישואים קודמים" }).click();
}

test("גרוש: אופן הפרידה 'גירושין' נבחר מראש, ותאריך הגירושין מוצג", async ({
  page,
}) => {
  // Act
  await addPreviousMarriage(page, "divorced");

  // Assert
  await expect(page.getByRole("radio", { name: "גירושין" })).toBeChecked();
  await expect(page.getByText("תאריך גירושין", { exact: true })).toBeVisible();
});

test("אלמן: אופן הפרידה 'פטירה' נבחר מראש", async ({ page }) => {
  // Act
  await addPreviousMarriage(page, "widowed");

  // Assert
  await expect(page.getByRole("radio", { name: "פטירה" })).toBeChecked();
  await expect(page.getByText("תאריך גירושין", { exact: true })).toHaveCount(0);
});
