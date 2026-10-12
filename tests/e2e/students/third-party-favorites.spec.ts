import { expect, test, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { createUserSessionClient } from "../forums/forum-fixtures";
import {
  addFavorite,
  readFavorites,
} from "../../../features/students/lib/favorites";
import { THIRD_PARTY_FAVORITE_MESSAGE } from "../../../features/students/lib/third-party-card";
import { TEST_USER_EMAIL } from "../shidduchim/fixtures";

/**
 * כרטיס צד שלישי שטרם אושר לקבלת הצעות אינו מועדף אפשרי: אין כוכב ברשימה,
 * addFavorite מסרב, ומועדף ישן שלו לא מגיע ללוח העבודה ולמועדפי לוח הבקרה -
 * אבל נשאר במטא-דאטה וחוזר מעצמו אחרי אישור ההנהלה.
 */
const LOAD_TIMEOUT = 15_000;
const TOKEN = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PENDING_LAST = `ממתין${TOKEN}`;
const REGULAR_LAST = `רגיל${TOKEN}`;

const admin = createServiceClient();
let userId = "";
let pendingId = "";
let regularId = "";
let previousFavorites: unknown = [];

async function setFavorites(favorites: string[]) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { favorites },
  });
  if (error) throw new Error(`עדכון המועדפים נכשל: ${error.message}`);
}

async function insertCard(lastName: string, cardFor: string) {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "מועדפות",
      last_name: lastName,
      birth_date: "1999-01-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
      card_for: cardFor,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
  return data.id as string;
}

test.beforeAll(async () => {
  userId = await getTestUserId(admin);
  const { data } = await admin.auth.admin.getUserById(userId);
  previousFavorites = data.user?.user_metadata?.favorites ?? [];
  pendingId = await insertCard(PENDING_LAST, "other");
  regularId = await insertCard(REGULAR_LAST, "self");
});

test.afterAll(async () => {
  await setFavorites(Array.isArray(previousFavorites) ? previousFavorites : []);
  await admin.from("students").delete().in("id", [pendingId, regularId]);
});

const rowFor = (page: Page, lastName: string) =>
  page.getByRole("row", { name: new RegExp(lastName) });

test.describe("מועדפים וכרטיס צד שלישי שטרם אושר להצעות", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("ברשימה אין כוכב לכרטיס שטרם אושר, וברגיל יש", async ({ page }) => {
    // Arrange
    await setFavorites([]);

    // Act
    await page.goto("/app/students");
    await page.locator("#search").fill(TOKEN);
    await expect(rowFor(page, REGULAR_LAST)).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });

    // Assert
    await expect(rowFor(page, PENDING_LAST)).toBeVisible();
    await expect(
      rowFor(page, PENDING_LAST).getByRole("button", { name: /מועדפים/ }),
    ).toHaveCount(0);
    await expect(
      rowFor(page, REGULAR_LAST).getByRole("button", {
        name: "הוסף למועדפים",
      }),
    ).toBeVisible();
  });

  test("addFavorite מסרב לכרטיס שטרם אושר ומאשר כרטיס רגיל", async () => {
    // Arrange
    await setFavorites([]);
    const client = await createUserSessionClient(admin, TEST_USER_EMAIL);

    // Act
    const refused = await addFavorite(client, pendingId);
    const allowed = await addFavorite(client, regularId);

    // Assert
    expect(refused).toEqual({
      ok: false,
      message: THIRD_PARTY_FAVORITE_MESSAGE,
    });
    expect(allowed.ok).toBe(true);
    const { data } = await admin.auth.admin.getUserById(userId);
    expect(readFavorites(data.user)).toEqual([regularId]);
  });

  test("מועדף ישן שטרם אושר לא בלוח ובלוח הבקרה, וחוזר אחרי אישור", async ({
    page,
  }) => {
    // Arrange - הכרטיס סומן כמועדף לפני שהוגבל
    await setFavorites([pendingId, regularId]);

    // Act + Assert - לוח העבודה
    await page.goto("/app/canvas");
    await expect(page.getByText(REGULAR_LAST).first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByText(PENDING_LAST)).toHaveCount(0);

    // Assert - לוח הבקרה (הטבלה "המועדפים שלך"; הכרטיסים גם ב"הכרטיסים שלי")
    await page.goto("/app");
    const favoritesTable = page.getByRole("table", { name: "המועדפים שלך" });
    await expect(favoritesTable.getByText(REGULAR_LAST)).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(favoritesTable.getByText(PENDING_LAST)).toHaveCount(0);

    // Assert - המטא-דאטה לא נמחק
    const { data } = await admin.auth.admin.getUserById(userId);
    expect(readFavorites(data.user)).toContain(pendingId);

    // Act - ההנהלה מאשרת קבלת הצעות
    const { error } = await admin
      .from("students")
      .update({ third_party_proposals_approved_at: new Date().toISOString() })
      .eq("id", pendingId);
    expect(error).toBeNull();

    // Assert - הכרטיס חוזר
    await page.goto("/app/canvas");
    await expect(page.getByText(PENDING_LAST).first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await page.goto("/app");
    await expect(
      page.getByRole("table", { name: "המועדפים שלך" }).getByText(PENDING_LAST),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});
