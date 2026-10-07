import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * כותרת אזור הכרטיסים בדשבורד לפי card_for: כרטיס עצמי - "הכרטיס שלי" ותג
 * בשורה; כרטיס לילד - "המיועדים שלך". הלוגיקה עצמה נבדקת ב-own-cards-heading.spec.ts.
 */
const LOAD_TIMEOUT = 15_000;

const admin = createServiceClient();
let userId = "";
let createdIds: string[] = [];
let originalCards: { id: string; card_for: string | null }[] = [];

async function setAllCardsFor(cardFor: "self" | "child") {
  const { error } = await admin
    .from("students")
    .update({ card_for: cardFor })
    .eq("user_id", userId)
    .in("id", [...createdIds, ...originalCards.map((card) => card.id)]);
  if (error) throw new Error(`עדכון card_for נכשל: ${error.message}`);
}

test.beforeAll(async () => {
  userId = await getTestUserId(admin);
  const { data: existing } = await admin
    .from("students")
    .select("id, card_for")
    .eq("user_id", userId)
    .is("deleted_at", null);
  originalCards = (existing ?? []) as typeof originalCards;

  // כרטיס משלנו, כדי שהבדיקה לא תידלג כשלמשתמש אין כרטיסים
  const { data: created, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "דשבורד",
      last_name: `עצמי${Date.now()}`,
      birth_date: "1999-01-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`יצירת הכרטיס נכשלה: ${error?.message}`);
  }
  createdIds = [created.id as string];
});

test.afterAll(async () => {
  if (createdIds.length > 0) {
    await admin.from("students").delete().in("id", createdIds);
  }
  for (const card of originalCards) {
    await admin
      .from("students")
      .update({ card_for: card.card_for })
      .eq("id", card.id);
  }
});

test("כרטיסים לעצמי: 'הכרטיס שלי' ותג בשורה", async ({ page }) => {
  // Arrange
  await setAllCardsFor("self");

  // Act
  await page.goto("/app");

  // Assert
  const cardCount = originalCards.length + createdIds.length;
  const heading = cardCount === 1 ? "הכרטיס שלי" : "הכרטיסים שלי";
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.getByRole("heading", { name: "המיועדים שלך" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("self-card-tag").first()).toHaveText(
    "הכרטיס שלי",
  );
});

test("כרטיסים לילד: 'המיועדים שלך' וללא תג", async ({ page }) => {
  // Arrange
  await setAllCardsFor("child");

  // Act
  await page.goto("/app");

  // Assert
  await expect(page.getByRole("heading", { name: "המיועדים שלך" })).toBeVisible(
    { timeout: LOAD_TIMEOUT },
  );
  await expect(page.getByTestId("self-card-tag")).toHaveCount(0);
});
