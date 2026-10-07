import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  pageAs,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import {
  FILLER_NAME,
  SEEDED,
  deleteCards,
  grandfatherCard,
  seedFullCard,
} from "./third-party-card-fixtures";

/**
 * כרטיס צד שלישי שלא אושר להצגה מלאה: שדכן (ואנונימי) רואה נתונים בסיסיים
 * בלבד, והנתונים הרגישים לא נשלחים לדפדפן בכלל (לא בעמוד ולא בתשובת ה-DB).
 * הממלא רואה הכול. אחרי אישור (או הענקה לכרטיס קיים) - הכול מוצג.
 */
const STAMP = Date.now();
const HIDDEN_NOTE = "פרטים נוספים בכרטיס זה יוצגו לאחר אישור הנהלת המערכת";

const RESTRICTED_VALUES = [
  SEEDED.about,
  SEEDED.fatherJob,
  SEEDED.motherJob,
  SEEDED.familyAbout,
  SEEDED.referenceName,
  SEEDED.partnerAbout,
  SEEDED.previousPartnerName,
  SEEDED.fillReason,
];

test.describe("הצגה מוגבלת של כרטיס צד שלישי", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let ownerId: string;
  let cardId: string;
  const createdIds: string[] = [];

  test.beforeAll(async () => {
    admin = createServiceClient();
    ownerId = await ensureCardManagerId(admin);
    cardId = await seedFullCard(admin, {
      ownerId,
      lastName: `הגבלה${STAMP}`,
    });
    createdIds.push(cardId);
  });

  test.afterAll(async () => {
    await deleteCards(admin, createdIds);
  });

  test("שדכן: נתונים בסיסיים בלבד, וההסבר על החלקים החבויים", async ({
    page,
  }) => {
    // Act
    await page.goto(`/app/students/${cardId}`);
    await expect(page.getByTestId("third-party-hidden-note")).toHaveText(
      HIDDEN_NOTE,
    );
    const html = await page.content();

    // Assert
    expect(html).toContain(SEEDED.city);
    expect(html).toContain(SEEDED.fatherName);
    expect(html).toContain(SEEDED.institutionName);
    expect(html).toContain(FILLER_NAME);
    for (const hidden of RESTRICTED_VALUES) {
      expect(html, `הערך החבוי ${hidden} נשלח לדפדפן`).not.toContain(hidden);
    }
    await expect(
      page.getByTestId("third-party-card-tag").first(),
    ).toContainText("מידע בסיסי · מולא ע״י צד שלישי");
  });

  test("שדכן: מסך העריכה סגור, והצ'אט עם הממלא נשאר פתוח", async ({ page }) => {
    // Act
    await page.goto(`/app/students/${cardId}/edit`);

    // Assert
    await expect(
      page.getByText("הכרטיס ממתין לאישור הנהלת המערכת"),
    ).toBeVisible();
    await page.goto(`/app/students/${cardId}`);
    await expect(page.getByRole("button", { name: "צ'אט" })).toBeEnabled();
  });

  test("גולש אנונימי (קישור שיתוף): אותו סט בסיסי", async ({ browser }) => {
    // Arrange
    const context = await browser.newContext({ locale: "he-IL" });
    const anonymous = await context.newPage();
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

    // Act
    await anonymous.goto(`${base}/app/students/${cardId}`);
    await expect(
      anonymous.getByTestId("third-party-hidden-note"),
    ).toBeVisible();
    const html = await anonymous.content();

    // Assert
    expect(html).toContain(SEEDED.city);
    for (const hidden of RESTRICTED_VALUES) {
      expect(html, `הערך החבוי ${hidden} נשלח לגולש אנונימי`).not.toContain(
        hidden,
      );
    }
    await context.close();
  });

  test("הממלא רואה הכול, כולל ההסבר, בלי הודעת הסתרה", async ({ browser }) => {
    // Arrange
    const filler = await pageAs(
      browser,
      admin,
      CARD_MANAGER_EMAIL,
      `/app/students/${cardId}`,
    );

    // Act
    await expect(filler.getByTestId("author-fill-reason")).toBeVisible();
    const html = await filler.content();

    // Assert
    for (const visible of RESTRICTED_VALUES) {
      expect(html, `הערך ${visible} חסר לממלא`).toContain(visible);
    }
    await expect(filler.getByTestId("third-party-hidden-note")).toHaveCount(0);
    await filler.context().close();
  });

  test("ב-DB: הטבלאות הרגישות ריקות לשדכן, ו-parents_info מחזיר שמות בלבד", async () => {
    // Arrange
    const matchmaker = await clientAs(admin, TEST_USER_EMAIL);

    // Act
    const references = await matchmaker
      .from("references")
      .select("name")
      .eq("student_id", cardId);
    const partner = await matchmaker
      .from("partner_preferences")
      .select("about_partner")
      .eq("student_id", cardId);
    const previous = await matchmaker
      .from("previous_partners")
      .select("full_name")
      .eq("student_id", cardId);
    const education = await matchmaker
      .from("education_history")
      .select("name")
      .eq("student_id", cardId);
    const parents = await matchmaker
      .from("students")
      .select("parents_info:parents_info_for_viewer")
      .eq("id", cardId)
      .single();

    // Assert
    expect(references.data).toEqual([]);
    expect(partner.data).toEqual([]);
    expect(previous.data).toEqual([]);
    expect(education.data).toHaveLength(1);
    expect(JSON.stringify(parents.data)).toContain(SEEDED.fatherName);
    expect(JSON.stringify(parents.data)).not.toContain(SEEDED.fatherJob);
  });

  test("אישור הצגה מלאה בלבד פותח את הכרטיס לשדכן (בלי הסבר הממלא)", async ({
    page,
  }) => {
    // Arrange
    await admin
      .from("students")
      .update({
        third_party_full_display_approved_at: new Date().toISOString(),
      })
      .eq("id", cardId);

    // Act
    await page.goto(`/app/students/${cardId}`);
    await expect(page.getByTestId("third-party-card-tag").first()).toHaveText(
      /^מולא ע״י צד שלישי/,
    );
    const html = await page.content();

    // Assert
    expect(html).toContain(SEEDED.referenceName);
    expect(html).toContain(SEEDED.partnerAbout);
    expect(html).toContain(SEEDED.about);
    expect(html).not.toContain(SEEDED.fillReason);
    await expect(page.getByTestId("third-party-hidden-note")).toHaveCount(0);
  });

  test("הענקה כמו ב-migration (שני אישורים) לכרטיס שקיים; חדש מתחיל לא מאושר", async ({
    page,
  }) => {
    // Arrange
    const legacyId = await seedFullCard(admin, {
      ownerId,
      lastName: `קיים${STAMP}`,
    });
    const freshId = await seedFullCard(admin, {
      ownerId,
      lastName: `חדש${STAMP}`,
    });
    createdIds.push(legacyId, freshId);
    await grandfatherCard(admin, legacyId);

    // Act
    await page.goto(`/app/students/${legacyId}`);
    const legacyHtml = await page.content();
    await page.goto(`/app/students/${freshId}`);
    const freshHtml = await page.content();

    // Assert
    expect(legacyHtml).toContain(SEEDED.referenceName);
    expect(freshHtml).not.toContain(SEEDED.referenceName);
    const { data: fresh } = await admin
      .from("students")
      .select(
        "third_party_full_display_approved_at, third_party_proposals_approved_at",
      )
      .eq("id", freshId)
      .single();
    expect(fresh).toEqual({
      third_party_full_display_approved_at: null,
      third_party_proposals_approved_at: null,
    });
  });
});
