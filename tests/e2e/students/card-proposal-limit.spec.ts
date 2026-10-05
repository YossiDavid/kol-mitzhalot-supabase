import { expect, test } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * "הגבלת הצעות" ומתג "בשידוכים" בטבלת "המיועדים שלך" בלוח הבקרה: בעל הכרטיס
 * קובע מספר ותקופה, ובהשהיית הנהלה המתג נעול עם הסבר.
 */
const RUN_ID = Date.now();
const LAST_NAME = `מכסה${RUN_ID}`;
const CARD_NAME = `לבדיקה ${LAST_NAME}`;

const admin = createServiceClient();
let cardId: string;

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "לבדיקה",
      last_name: LAST_NAME,
      gender: "male",
      birth_date: "1998-01-01",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  cardId = data.id;
});

test.afterAll(async () => {
  if (cardId) await admin.from("students").delete().eq("id", cardId);
});

const readLimit = async () => {
  const { data } = await admin
    .from("students")
    .select("proposal_limit_count, proposal_limit_period")
    .eq("id", cardId)
    .single();
  return data;
};

test("הבעלים קובע הגבלה של מספר ותקופה, ומבטל אותה", async ({ page }) => {
  // Arrange
  await page.goto("/app");
  await page.getByRole("button", { name: `הגבלת הצעות: ${CARD_NAME}` }).click();

  // Act
  await page.getByLabel("מספר הצעות").fill("2");
  await page.getByLabel("בכל").selectOption("week");
  await page.getByRole("button", { name: "שמירה" }).click();

  // Assert
  await expect(page.getByText("ההגבלה נשמרה")).toBeVisible();
  expect(await readLimit()).toEqual({
    proposal_limit_count: 2,
    proposal_limit_period: "week",
  });
  await expect(
    page.getByRole("button", { name: `הגבלת הצעות: ${CARD_NAME}` }),
  ).toContainText("2 הצעות לשבוע");

  // Act - ביטול
  await page.getByRole("button", { name: `הגבלת הצעות: ${CARD_NAME}` }).click();
  await page.getByRole("button", { name: "ללא הגבלה" }).click();

  // Assert
  await expect(page.getByText("ההגבלה בוטלה")).toBeVisible();
  expect(await readLimit()).toEqual({
    proposal_limit_count: null,
    proposal_limit_period: null,
  });
});

test("מספר לא תקין חוסם את השמירה", async ({ page }) => {
  // Arrange
  await page.goto("/app");
  await page.getByRole("button", { name: `הגבלת הצעות: ${CARD_NAME}` }).click();

  // Act
  await page.getByLabel("מספר הצעות").fill("0");

  // Assert
  await expect(page.getByRole("button", { name: "שמירה" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("מספר שלם");
});

test("השהיית הנהלה: המתג נעול ומוצגת הסיבה", async ({ page }) => {
  // Arrange
  await admin
    .from("students")
    .update({ admin_paused_at: new Date().toISOString() })
    .eq("id", cardId);

  try {
    // Act
    await page.goto("/app");

    // Assert
    const toggle = page.getByRole("switch", {
      name: `פעיל בשידוכים: ${CARD_NAME}`,
    });
    await expect(toggle).toBeDisabled();
    await expect(toggle).not.toBeChecked();
    await expect(
      page.getByText("הכרטיס הושהה על ידי הנהלת המערכת").first(),
    ).toBeVisible();
  } finally {
    await admin
      .from("students")
      .update({ admin_paused_at: null, admin_paused_by: null })
      .eq("id", cardId);
  }
});
