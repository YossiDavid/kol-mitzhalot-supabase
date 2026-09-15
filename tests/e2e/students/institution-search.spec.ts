import { test, expect } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * "לבחירה מתוך המאגר" ברשומות ההשכלה מחפש בטבלת institutions לפי סוג המוסד
 * ומגדר (ולא ב-/educational-institutions/*, שמעולם לא היה קיים ומחזיר 404).
 * הבחירה ממלאת את שם המוסד ואת העיר בשורה, כי education_history שומרת אותם
 * ולא את המזהה.
 */

const RUN_ID = Date.now();
const SEARCH_TERM = `מוסד בדיקה ${RUN_ID}`;
const KETANA = {
  name: `${SEARCH_TERM} קטנה`,
  city: "עיר בדיקה",
  gender: "male",
  type: "yeshiva_ketana",
  is_active: true,
};
// אותו שם בסיס, סוג אחר - אסור שיופיע בחיפוש של ישיבה קטנה
const KOLLEL = {
  name: `${SEARCH_TERM} כולל`,
  city: "עיר בדיקה",
  gender: "male",
  type: "kollel",
  is_active: true,
};

test.describe("חיפוש מוסד ברשומות ההשכלה", () => {
  const admin = createServiceClient();
  const institutionIds: string[] = [];

  test.beforeAll(async () => {
    const { data, error } = await admin
      .from("institutions")
      .insert([KETANA, KOLLEL])
      .select("id");
    if (error || !data) {
      throw new Error(`יצירת מוסדות הבדיקה נכשלה: ${error?.message}`);
    }
    institutionIds.push(...data.map((row) => row.id as string));
  });

  test.afterAll(async () => {
    if (institutionIds.length === 0) return;
    await admin.from("institutions").delete().in("id", institutionIds);
  });

  test("ישיבה קטנה: מוצאים מוסד מהסוג הנכון, והבחירה ממלאת שם ועיר", async ({
    page,
  }) => {
    // Arrange
    const notFoundUrls: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 404) notFoundUrls.push(response.url());
    });
    await page.goto("/app/students/create");
    await page.getByRole("radio", { name: "מיועד", exact: true }).check();
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים נוספים", exact: true })
      .click();
    await page.getByRole("button", { name: "הוספת ישיבה קטנה" }).click();
    const searchCell = page.locator(
      '[data-field-name="education.yeshivaKtana.0.id"]',
    );

    // Act
    await searchCell.getByRole("combobox").click();
    await page.getByPlaceholder("חיפוש...").fill(SEARCH_TERM);

    // Assert
    const listbox = page.getByRole("listbox");
    await expect(
      listbox.getByRole("option", { name: KETANA.name }),
    ).toBeVisible();
    await expect(listbox.getByRole("option", { name: KOLLEL.name })).toHaveCount(
      0,
    );

    // Act
    await listbox.getByRole("option", { name: KETANA.name }).click();

    // Assert
    await expect(searchCell.getByRole("combobox")).toHaveText(KETANA.name);
    await expect(page.locator("#education-yeshivaKtana-0-name")).toHaveValue(
      KETANA.name,
    );
    await expect(page.locator("#education-yeshivaKtana-0-city")).toHaveValue(
      KETANA.city,
    );
    expect(notFoundUrls).toEqual([]);
  });
});
