import { test, expect, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * הורה שנפטר: "מי נפטר" נאסף בשלב "מצב ההורים", לפני "על המשפחה", ושם לא
 * נשאלים טלפון, עיסוק ואימייל של ההורה שנפטר. בכרטיס מופיע ז"ל ליד השם,
 * גם כששני ההורים נפטרו.
 */

const admin = createServiceClient();
const RUN_ID = Date.now();
const PARENTS_STEP = "מצב ההורים";
const FAMILY_STEP = "על המשפחה";
const DEATH_MARK = "ז״ל";
const FATHER_DEATH_DATE = "1995-03-03";
const MOTHER_DEATH_DATE = "2001-04-04";

const nameParts = (name: string) => ({ prefix: "", name, suffix: "" });

async function openStep(page: Page, title: string) {
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: title, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

/** פותחים טופס חדש, עוברים את ההקדמה ובוחרים אלמנ/ה והורה שנפטר */
async function startWidowedForm(page: Page, deadParentLabel: string) {
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "עבור בני או בתי" }).check();
  await page.getByRole("radio", { name: "מיועד", exact: true }).check();
  await openStep(page, PARENTS_STEP);
  await page.getByRole("radio", { name: "אלמנ/ה" }).check();
  await page.getByRole("radio", { name: deadParentLabel, exact: true }).check();
}

test.describe("הורה שנפטר בטופס", () => {
  test("שלב מצב ההורים בא לפני על המשפחה", async ({ page }) => {
    // Arrange
    await page.goto("/app/students/create");

    // Act
    const stepTitles = await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button")
      .allInnerTexts();

    // Assert
    const parentsIndex = stepTitles.findIndex((t) => t.includes(PARENTS_STEP));
    const familyIndex = stepTitles.findIndex((t) => t.includes(FAMILY_STEP));
    expect(parentsIndex).toBeGreaterThan(-1);
    expect(parentsIndex).toBeLessThan(familyIndex);
  });

  test("האב נפטר: אין טלפון, עיסוק ואימייל לאב; האם והשם נשארים", async ({
    page,
  }) => {
    // Arrange + Act
    await startWidowedForm(page, "האב");
    await openStep(page, FAMILY_STEP);

    // Assert
    await expect(page.locator("#father-self")).toBeVisible();
    await expect(page.locator("#father-phone")).toHaveCount(0);
    await expect(page.locator("#father-job")).toHaveCount(0);
    await expect(page.locator("#father-email")).toHaveCount(0);
    await expect(page.locator("#mother-phone")).toBeVisible();
    await expect(page.locator("#mother-job")).toBeVisible();
  });

  test("האם נפטרה: אין טלפון, עיסוק ואימייל לאם", async ({ page }) => {
    // Arrange + Act
    await startWidowedForm(page, "האם");
    await openStep(page, FAMILY_STEP);

    // Assert
    await expect(page.locator("#mother-self")).toBeVisible();
    await expect(page.locator("#mother-phone")).toHaveCount(0);
    await expect(page.locator("#mother-job")).toHaveCount(0);
    await expect(page.locator("#mother-email")).toHaveCount(0);
    await expect(page.locator("#father-phone")).toBeVisible();
  });

  test("שניהם נפטרו: אין פרטי קשר לאף הורה", async ({ page }) => {
    // Arrange + Act
    await startWidowedForm(page, "שניהם");
    await openStep(page, FAMILY_STEP);

    // Assert
    await expect(page.locator("#father-self")).toBeVisible();
    await expect(page.locator("#mother-self")).toBeVisible();
    for (const field of ["phone", "job", "email"]) {
      await expect(page.locator(`#father-${field}`)).toHaveCount(0);
      await expect(page.locator(`#mother-${field}`)).toHaveCount(0);
    }
  });

  test("חזרה לסטטוס נשואים מחזירה את פרטי הקשר", async ({ page }) => {
    // Arrange
    await startWidowedForm(page, "האב");

    // Act
    await page.getByRole("radio", { name: "נשואים" }).check();
    await openStep(page, FAMILY_STEP);

    // Assert
    await expect(page.locator("#father-phone")).toBeVisible();
    await expect(page.locator("#mother-phone")).toBeVisible();
  });
});

test.describe.serial("ז״ל בכרטיס", () => {
  const studentIds: string[] = [];

  const LEGACY_PHONE = "050-7654321";
  const LEGACY_JOB = "מלמד ישן";
  const LEGACY_EMAIL = "legacy-dead@example.com";
  const ALIVE_PHONE = "052-1112223";

  async function createWidowedFamilyStudent(
    deadParent: "father" | "mother" | "both",
    withLegacyContact = false,
  ): Promise<string> {
    const userId = await getTestUserId(admin);
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: userId,
        first_name: "יתום",
        last_name: `יתום${deadParent}${RUN_ID}`,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        street: "רבי עקיבא",
        house: "3",
        in_shidduchim: true,
        parents_info: {
          status: "widowed",
          deadParent,
          fatherDeathDate: FATHER_DEATH_DATE,
          motherDeathDate: MOTHER_DEATH_DATE,
          father: {
            self: nameParts("אברהם"),
            ...(withLegacyContact && {
              phone: LEGACY_PHONE,
              job: LEGACY_JOB,
              email: LEGACY_EMAIL,
            }),
          },
          mother: {
            self: nameParts("רחל"),
            maidenName: "לוי",
            ...(withLegacyContact && { phone: ALIVE_PHONE }),
          },
        },
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
    }
    studentIds.push(data.id as string);
    return data.id as string;
  }

  test.afterAll(async () => {
    if (studentIds.length === 0) return;
    await admin.from("students").delete().in("id", studentIds);
  });

  test("האב נפטר: ז״ל רק ליד האב", async ({ page }) => {
    // Arrange
    const id = await createWidowedFamilyStudent("father");

    // Act
    await page.goto(`/app/students/${id}`);

    // Assert
    await expect(page.getByText(DEATH_MARK)).toHaveCount(1);
    await expect(page.getByText(/אברהם\s+ז״ל/)).toBeVisible();
    await expect(page.getByText(/נפטר ב-/)).toHaveCount(1);
  });

  test("שניהם נפטרו: ז״ל ליד שני ההורים ושני תאריכי פטירה", async ({
    page,
  }) => {
    // Arrange
    const id = await createWidowedFamilyStudent("both");

    // Act
    await page.goto(`/app/students/${id}`);

    // Assert
    await expect(page.getByText(DEATH_MARK)).toHaveCount(2);
    await expect(page.getByText(/אברהם\s+ז״ל/)).toBeVisible();
    await expect(page.getByText(/רחל\s+ז״ל/)).toBeVisible();
    await expect(page.getByText(/נפטר ב-/)).toHaveCount(1);
    await expect(page.getByText(/נפטרה ב-/)).toHaveCount(1);
  });

  test("נתוני legacy: טלפון, עיסוק ואימייל של הורה שנפטר לא מוצגים", async ({
    page,
  }) => {
    // Arrange: האב נפטר אך בנתונים עדיין יש לו פרטי קשר; לאם (בחיים) יש טלפון
    const id = await createWidowedFamilyStudent("father", true);

    // Act
    await page.goto(`/app/students/${id}`);

    // Assert
    await expect(page.getByText(/אברהם\s+ז״ל/)).toBeVisible();
    await expect(page.getByText(LEGACY_PHONE)).toHaveCount(0);
    await expect(page.getByText(LEGACY_JOB)).toHaveCount(0);
    await expect(page.getByText(LEGACY_EMAIL)).toHaveCount(0);
    await expect(page.getByText(ALIVE_PHONE)).toBeVisible();
  });
});
