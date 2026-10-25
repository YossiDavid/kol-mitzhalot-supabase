import { chooseChildCard } from "./card-for-fixtures";
import { test, expect, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { approvedCard } from "../helpers/approved-card";
import { addStudentPhoto } from "../helpers/student-photo";
import { continuePastDonationDialog } from "../helpers/donation-dialog";

/**
 * סבים וסבתות בטופס הכרטיס: (1) התוויות מנוסחות מנקודת המבט של ההורה שבמקטע
 * ואינן תלויות במגדר המיועד/ת; (2) ארבעת השדות רשות - הטופס מתקדם ונשמר בלעדיהם;
 * (3) הכרטיס מוצג נקי כשהם ריקים, ובתוויות הנכונות כשהם מלאים.
 */
const admin = createServiceClient();
const RUN_ID = Date.now();
const SAVE_TIMEOUT_MS = 20_000;
const SLOW_TEST_TIMEOUT_MS = 90_000;
const STUDENT_URL_ID = /\/app\/students\/([a-f0-9-]{36})/;

const fill = (page: Page, fieldName: string, value: string) =>
  page.locator(`#${fieldName.replace(/[^a-zA-Z0-9]+/g, "-")}`).fill(value);
const next = (page: Page) => page.locator("button:has-text('הבא')").click();

const cell = (page: Page, field: string) =>
  page.locator(`[data-field-name="${field}"]`);

/** מגיע לשלב "על המשפחה" אחרי בחירת מגדר המיועד/ת */
async function openFamilyStep(page: Page, gender: "גבר" | "אשה") {
  await page.goto("/app/students/create");
  await chooseChildCard(page);
  await page.getByRole("radio", { name: gender, exact: true }).check();
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: "על המשפחה", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "על המשפחה" })).toBeVisible();
}

const EXPECTED_LABELS = [
  ["father.grandFather", "שם אביו"],
  ["father.grandMother", "שם אמו"],
  ["mother.grandFather", "שם אביה"],
  ["mother.grandMother", "שם אמה"],
] as const;

test.describe("סבים וסבתות - תוויות", () => {
  for (const gender of ["גבר", "אשה"] as const) {
    test(`${gender}: התוויות לפי ההורה שבמקטע, ללא כוכבית חובה`, async ({
      page,
    }) => {
      // Arrange + Act
      await openFamilyStep(page, gender);

      // Assert
      for (const [field, label] of EXPECTED_LABELS) {
        const fieldCell = cell(page, field);
        await expect(fieldCell.getByText(label, { exact: true })).toBeVisible();
        await expect(fieldCell).not.toContainText("*");
      }
      // הניסוח הישן, התלוי במגדר המיועד/ת, לא מופיע
      for (const old of ["אם אמו", "אם אמה", "אבי אמו", "אבי אמה", "אימה"]) {
        await expect(page.getByText(old)).toHaveCount(0);
      }
    });
  }
});

test.describe("סבים וסבתות - רשות", () => {
  const createdIds: string[] = [];

  test.afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("students").delete().in("id", createdIds);
    }
  });

  test("הטופס מתקדם ונשמר בלי ארבעת השדות, והכרטיס נקי משורות ריקות", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    const lastName = `ללאסבים${RUN_ID}`;

    // Arrange - אשף היצירה, בלי למלא סבים וסבתות
    await page.goto("/app/students/create");
    await chooseChildCard(page);
    await page.getByRole("radio", { name: "גבר", exact: true }).click();
    await next(page);
    await fill(page, "firstName", "בלי");
    await fill(page, "lastName", lastName);
    await fill(page, "country", "ישראל");
    await fill(page, "city", "בני ברק");
    await fill(page, "street", "רב שך");
    await fill(page, "house", "5");
    await page.locator('input[placeholder="בחר תאריך עברי"]').click();
    await page.locator(".grid-cols-7 button").first().click();
    const selects = page.locator("[data-slot='native-select']");
    await selects.nth(0).selectOption("single");
    await selects.nth(1).selectOption("kosher");
    await selects.nth(2).selectOption("koilel");
    // תמונה: חובה בכרטיס של גבר
    await addStudentPhoto(page);
    await next(page);
    await expect(page.locator("button:has-text('הבא')")).toBeVisible();
    await next(page);
    await expect(page.locator("text=על המשפחה").first()).toBeVisible();
    await fill(page, "father.self", "אברהם");
    await fill(page, "father.phone", "0501234567");
    await fill(page, "father.job", "מלמד");
    await fill(page, "mother.self", "רחל");
    await fill(page, "mother.maidenName", "לוי");
    await fill(page, "mother.phone", "0507654321");
    await fill(page, "mother.job", "מורה");
    await fill(page, "family.numberOfChildren", "5");
    await fill(page, "family.currentChildPlace", "3");
    await fill(page, "family.about", "משפחה תורנית");

    // Act - מתקדמים לשלב הבא למרות ארבעת השדות הריקים
    await next(page);

    // Assert
    await expect(page.getByText("נא למלא שם אביו")).toHaveCount(0);
    await expect(page.getByText("נא למלא שם אמה")).toHaveCount(0);
    await expect(page.locator("button:has-text('הבא')")).toBeVisible();
    await next(page);
    await expect(page.locator("button:has-text('הבא')")).toBeVisible();
    await next(page);
    await expect(page.locator("button[type='submit']")).toBeVisible();
    await fill(page, "partner.additionalInformation", "מחפשים בן תורה");
    await page.locator("button[type='submit']").click();
    await continuePastDonationDialog(page, SAVE_TIMEOUT_MS);
    await expect(page).toHaveURL(STUDENT_URL_ID, { timeout: SAVE_TIMEOUT_MS });
    createdIds.push(page.url().match(STUDENT_URL_ID)?.[1] ?? "");

    await expect(page.getByText("רקע משפחתי")).toBeVisible();
    for (const label of ["אביו:", "אמו:", "אביה:", "אמה:"]) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test("כרטיס עם סבים וסבתות מציג אותם בתוויות לפי ההורה", async ({ page }) => {
    // Arrange
    const userId = await getTestUserId(admin);
    const name = (value: string) => ({ prefix: "", name: value, suffix: "" });
    const { data, error } = await admin
      .from("students")
      .insert(
        approvedCard({
          user_id: userId,
          card_for: "self",
          first_name: "עם",
          last_name: `סבים${RUN_ID}`,
          birth_date: "1999-01-01",
          gender: "male",
          personal_status: "single",
          country: "ישראל",
          city: "בני ברק",
          in_shidduchim: true,
          parents_info: {
            status: "married",
            father: {
              self: name("אב"),
              grandFather: name("סב-אב-בדיקה"),
              grandMother: name("סבתא-אב-בדיקה"),
            },
            mother: {
              self: name("אם"),
              grandFather: name("סב-אם-בדיקה"),
              grandMother: name("סבתא-אם-בדיקה"),
            },
          },
        }),
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת כרטיס: ${error?.message}`);
    createdIds.push(data.id as string);

    // Act
    await page.goto(`/app/students/${data.id}`);

    // Assert
    for (const label of ["אביו:", "אמו:", "אביה:", "אמה:"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("סבתא-אם-בדיקה")).toBeVisible();
    await expect(page.getByText("אימה:")).toHaveCount(0);
  });
});
