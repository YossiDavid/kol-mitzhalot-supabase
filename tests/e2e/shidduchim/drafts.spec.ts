import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  deletePair,
  getShidduch,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

const DRAFTS_URL = "/app/shadchan/drafts";
const PROPOSALS_URL = "/app/shadchan/proposals";
const LOAD_TIMEOUT = 15_000;

/** הערה ייחודית לכל הרצה, כדי לזהות את הכרטיס גם כשיש במסד הצעות אחרות */
const uniqueNote = (label: string) => `${label} ${Date.now()}`;

/** הרשימה נטענת ב-Suspense: מחכים שהשלד ייעלם לפני בדיקת היעדר כרטיס */
async function waitForList(page: Page) {
  await expect(page.getByRole("status", { name: "טוען" })).toHaveCount(0, {
    timeout: LOAD_TIMEOUT,
  });
}

/**
 * טיוטות מוצגות בדף "הצעות שמורות" בלבד, והצעות שנשלחו — ב"כל השידוכים
 * שלי" בלבד. הבדיקות מקימות לעצמן מיועדים ואינן נשענות על supabase/seed.sql.
 */
test.describe("הצעות שמורות — הפרדה בין טיוטות להצעות שנשלחו", () => {
  let admin: SupabaseClient;
  let testUserId: string;
  let fx: ShidduchFixtures;

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  // ניקוי לפני ואחרי: שארית מהרצה שנקטעה הייתה נתקלת ב-unique_shidduch_pair
  const cleanPairs = async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await deletePair(admin, fx.groomSecond, fx.brideSecond);
  };

  test.beforeEach(cleanPairs);
  test.afterEach(cleanPairs);

  test("טיוטה מופיעה בהצעות השמורות ולא ברשימת ההצעות שנשלחו", async ({
    page,
  }) => {
    // Arrange
    const draftNote = uniqueNote("טיוטה לבדיקת ההצעות השמורות");
    await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
      status: "draft",
      noteForGroom: draftNote,
    });

    // Act
    await page.goto(DRAFTS_URL);

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: "הצעות שמורות" }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    const draftCard = page.getByRole("article").filter({ hasText: draftNote });
    await expect(draftCard).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(
      draftCard.getByRole("button", { name: "עריכה ושליחה" }),
    ).toBeVisible();

    // Act
    await page.goto(PROPOSALS_URL);
    await waitForList(page);

    // Assert
    await expect(
      page.getByRole("link", { name: /הצעות שמורות \(\d+\)/ }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByText(draftNote)).toHaveCount(0);
  });

  test("הצעה שנשלחה מופיעה ברשימת ההצעות ולא בהצעות השמורות", async ({
    page,
  }) => {
    // Arrange
    const sentNote = uniqueNote("הצעה שנשלחה לבדיקת ההפרדה");
    await insertShidduch(admin, {
      groomId: fx.groomSecond,
      brideId: fx.brideSecond,
      shadchanId: testUserId,
      status: "sent",
      noteForBride: sentNote,
    });

    // Act
    await page.goto(PROPOSALS_URL);

    // Assert
    await expect(
      page.getByRole("article").filter({ hasText: sentNote }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Act
    await page.goto(DRAFTS_URL);
    await waitForList(page);

    // Assert
    await expect(page.getByText(sentNote)).toHaveCount(0);
  });

  test("מחיקת טיוטה מהדף — הכרטיס נעלם והשורה נמחקת", async ({ page }) => {
    // Arrange
    const draftNote = uniqueNote("טיוטה לבדיקת מחיקה מההצעות השמורות");
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
      status: "draft",
      noteForGroom: draftNote,
    });
    await page.goto(DRAFTS_URL);
    const draftCard = page.getByRole("article").filter({ hasText: draftNote });
    await expect(draftCard).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Act
    await draftCard.getByRole("button", { name: "מחיקת ההצעה" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "מחיקת ההצעה" })
      .click();

    // Assert
    await expect(page).toHaveURL(new RegExp(DRAFTS_URL));
    await expect(page.getByText(draftNote)).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
    expect(await getShidduch(admin, id)).toBeNull();
  });
});
