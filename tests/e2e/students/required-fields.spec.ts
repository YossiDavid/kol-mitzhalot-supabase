import { test, expect, type Page } from "@playwright/test";

import {
  studentFields,
  type FormSteps,
} from "../../../features/students/components/create-form/fileds-data";
import {
  collectRequiredIssues,
  isEmptyFieldValue,
} from "../../../features/students/components/create-form/required-fields";

/**
 * `required: true` במערך השדות (fileds-data.ts) הוא מקור האמת היחיד: הוא מציג
 * כוכבית אדומה, והוא מה שנאכף במעבר שלב ובשליחה (required-fields.ts).
 */

// הסט שנאכף לפני שהאכיפה נגזרה מהנתונים. שינוי כאן = שדה חובה נוסף או הוסר
const EXPECTED_REQUIRED_PATHS = [
  "gender",
  "firstName",
  "lastName",
  "identityNumber",
  "birthDate",
  "country",
  "city",
  "street",
  "house",
  "personalStatus",
  "cellphoneType",
  "father.self",
  "father.phone",
  "father.job",
  "father.grandFather",
  "father.grandMother",
  "mother.self",
  "mother.phone",
  "mother.job",
  "mother.grandFather",
  "mother.grandMother",
  "mother.maidenName",
  "family.numberOfChildren",
  "family.currentChildPlace",
  "family.about",
  "partner.additionalInformation",
  "author.name",
  "author.phone",
  "author.relation",
];

const PERSONAL_STEP_REQUIRED = [
  "birthDate",
  "cellphoneType",
  "city",
  "country",
  "firstName",
  "house",
  "identityNumber",
  "lastName",
  "personalStatus",
  "street",
];

const FAMILY_STEP_REQUIRED = [
  "family.about",
  "family.currentChildPlace",
  "family.numberOfChildren",
  "father.grandFather",
  "father.grandMother",
  "father.job",
  "father.phone",
  "father.self",
  "mother.grandFather",
  "mother.grandMother",
  "mother.job",
  "mother.maidenName",
  "mother.phone",
  "mother.self",
];

// רשומה חוזרת עם שדה חובה בשורה ושדה חובה שמוצג רק לפי ערך באותה שורה.
// בנתונים האמיתיים אין היום שדה חובה בתוך רשומה חוזרת, ולכן המנגנון נבדק כאן
const repeaterSteps = (isRepeaterRequired = false): FormSteps[] => [
  {
    name: "step",
    title: "",
    sections: [
      {
        name: "section",
        title: "",
        fields: [
          {
            type: "repeater",
            name: "items",
            required: isRepeaterRequired,
            fileds: [
              { name: "items.name", label: "שם", type: "text", required: true },
              {
                name: "items.kind",
                label: "סוג",
                type: "radio",
                options: [],
              },
              {
                name: "items.reason",
                label: "סיבה",
                type: "text",
                required: true,
                condition: [
                  { parameter: "items.kind", operator: "===", value: "other" },
                ],
              },
            ],
          },
          {
            name: "femaleOnly",
            label: "למיועדת בלבד",
            type: "text",
            required: true,
            condition: [
              { parameter: "gender", operator: "===", value: "female" },
            ],
          },
        ],
      },
    ],
  },
];

const issuePaths = (steps: readonly FormSteps[], values: unknown) =>
  collectRequiredIssues(steps, values)
    .map((issue) => issue.path)
    .sort();

test.describe("כללי שדה חובה נגזרים ממערך השדות", () => {
  test("הסט של שדות החובה לא השתנה, לשני המגדרים", () => {
    // Arrange
    const expectedWithoutGender = EXPECTED_REQUIRED_PATHS.filter(
      (path) => path !== "gender",
    ).sort();

    // Act
    const withoutGender = issuePaths(studentFields, {});
    const male = issuePaths(studentFields, { gender: "male" });
    const female = issuePaths(studentFields, { gender: "female" });

    // Assert
    expect(withoutGender).toEqual([...EXPECTED_REQUIRED_PATHS].sort());
    expect(male).toEqual(expectedWithoutGender);
    expect(female).toEqual(expectedWithoutGender);
  });

  test("רשומה חוזרת: נאכף רק בשורות קיימות ורק כשהשדה מוצג", () => {
    // Arrange
    const steps = repeaterSteps();

    // Act
    const noRows = issuePaths(steps, { gender: "male", items: [] });
    const emptyRow = issuePaths(steps, { gender: "male", items: [{}] });
    const otherKind = issuePaths(steps, {
      gender: "male",
      items: [{ name: "  ", kind: "other" }, { name: "מלא" }],
    });
    const hiddenByGender = issuePaths(steps, { gender: "female", items: [] });

    // Assert
    expect(noRows).toEqual([]);
    expect(emptyRow).toEqual(["items.0.name"]);
    expect(otherKind).toEqual(["items.0.name", "items.0.reason"]);
    expect(hiddenByGender).toEqual(["femaleOnly"]);
  });

  test("רשומה חוזרת שסומנה חובה דורשת לפחות שורה אחת", () => {
    // Arrange
    const steps = repeaterSteps(true);

    // Act
    const noRows = issuePaths(steps, { gender: "male", items: [] });
    const filledRow = issuePaths(steps, {
      gender: "male",
      items: [{ name: "מלא" }],
    });

    // Assert
    expect(noRows).toEqual(["items"]);
    expect(filledRow).toEqual([]);
  });

  test("מה נחשב ריק", () => {
    // Arrange
    const newFile = new Blob(["x"]);

    // Act + Assert
    expect(isEmptyFieldValue(undefined)).toBe(true);
    expect(isEmptyFieldValue(null)).toBe(true);
    expect(isEmptyFieldValue("   ")).toBe(true);
    expect(isEmptyFieldValue([])).toBe(true);
    expect(isEmptyFieldValue({ file: null })).toBe(true);
    expect(
      isEmptyFieldValue({ prefix: "הרב", name: "", suffix: "" }, "textAndSelect"),
    ).toBe(true);

    expect(isEmptyFieldValue("א")).toBe(false);
    expect(
      isEmptyFieldValue({ prefix: "", name: "משה", suffix: "" }, "textAndSelect"),
    ).toBe(false);
    expect(isEmptyFieldValue({ file: newFile })).toBe(false);
    // עריכה: קו״ח שמור ותמונה שמורה נחשבים מולאו
    expect(
      isEmptyFieldValue({ file: null, existingUrl: "id/cv/file.pdf" }),
    ).toBe(false);
    expect(
      isEmptyFieldValue([{ kind: "existing", path: "id/photos/a.jpg", url: null }]),
    ).toBe(false);
  });
});

async function readRequiredState(page: Page) {
  return page.locator("form").evaluate((form) => {
    // תא של שדה בודד - לא התא שעוטף רשומה חוזרת שלמה
    const cells = Array.from(
      form.querySelectorAll<HTMLElement>("[data-field-name]"),
    ).filter((cell) => !cell.querySelector("[data-field-name]"));
    const collect = (selector: string) =>
      [
        ...new Set(
          cells
            .filter((cell) => cell.querySelector(selector))
            .map((cell) => cell.getAttribute("data-field-name") ?? ""),
        ),
      ].sort();

    return {
      cellCount: cells.length,
      starred: collect("label span.text-destructive"),
      errored: collect('p.text-destructive[id$="-message"]'),
    };
  });
}

test.describe("כוכבית ואכיפה בטופס", () => {
  test("פרטים אישיים: שדות עם כוכבית הם בדיוק השדות שנחסמים", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/students/create");
    await page.getByRole("radio", { name: "מיועד", exact: true }).check();
    const nextButton = page.getByRole("button", { name: "המשך לשלב הבא" });
    await nextButton.click();
    await expect(
      page.getByRole("heading", { name: "פרטים אישיים" }),
    ).toBeVisible();

    // Act
    await nextButton.click();
    await expect(
      page.locator('[data-field-name="firstName"] p.text-destructive'),
    ).toBeVisible();

    // Assert
    const state = await readRequiredState(page);
    expect(state.starred).toEqual(PERSONAL_STEP_REQUIRED);
    expect(state.errored).toEqual(state.starred);
    expect(state.cellCount).toBeGreaterThan(state.starred.length);
  });

  test("על המשפחה, כולל שורת מחותן: כוכבית = שגיאה", async ({ page }) => {
    // Arrange
    await page.goto("/app/students/create");
    await page.getByRole("radio", { name: "מיועד", exact: true }).check();
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "על המשפחה", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "על המשפחה" })).toBeVisible();
    // שורה ריקה לא חוסמת: אין בה שדה חובה, ולכן גם אין בה כוכבית
    await page.getByRole("button", { name: "הוספת מחותן" }).click();
    await expect(
      page.locator('[data-field-name="family.mechutanim.0.firstName"]'),
    ).toBeVisible();

    // Act
    await page.getByRole("button", { name: "המשך לשלב הבא" }).click();
    await expect(
      page.locator('[data-field-name="father.self"] p.text-destructive'),
    ).toBeVisible();

    // Assert
    const state = await readRequiredState(page);
    expect(state.starred).toEqual(FAMILY_STEP_REQUIRED);
    expect(state.errored).toEqual(state.starred);
    await expect(page.locator("#father-self")).toBeFocused();
  });

  test("רדיו חובה: הודעה משלו ופוקוס על האפשרות הראשונה", async ({ page }) => {
    // Arrange
    await page.goto("/app/students/create");
    const genderCell = page.locator('[data-field-name="gender"]');
    await expect(genderCell.locator("label span.text-destructive")).toBeVisible();

    // Act
    await page.getByRole("button", { name: "המשך לשלב הבא" }).click();

    // Assert
    await expect(genderCell.getByText("נא לבחור מיועד/מיועדת")).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "מיועד", exact: true }),
    ).toBeFocused();
  });

  test("תאריך לידה: גובה ומסגרת שגיאה כמו שדה טקסט", async ({ page }) => {
    // Arrange
    await page.goto("/app/students/create");
    await page.getByRole("radio", { name: "מיועד", exact: true }).check();
    const nextButton = page.getByRole("button", { name: "המשך לשלב הבא" });
    await nextButton.click();
    const dateInput = page.locator("#birthDate");
    const textInput = page.locator("#firstName");
    await expect(dateInput).toBeVisible();

    // Act
    await nextButton.click();
    await expect(textInput).toHaveAttribute("aria-invalid", "true");

    // Assert
    const readBox = (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);
        return { height: style.height, borderColor: style.borderTopColor };
      });
    const dateBox = await readBox("#birthDate");
    const textBox = await readBox("#firstName");
    expect(dateBox).toEqual(textBox);
    await expect(
      page.locator('[data-field-name="birthDate"]').getByText("נא לבחור תאריך לידה"),
    ).toBeVisible();
  });
});
