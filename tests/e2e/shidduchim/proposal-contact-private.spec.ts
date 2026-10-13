import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createCard,
  ensureSecondParentId,
  pageAs,
} from "../chats/context-fixtures";
import { deleteCards } from "../students/third-party-card-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
  insertShidduch,
} from "./fixtures";

/**
 * פרטי התקשרות אינם נפתחים לצד השני בהצעה: בחלון השליחה אין עוד בחירה כזו,
 * הנתיב מתעלם ממנה גם כשלקוח ישן שולח אותה, ומה שהשדכן כן בוחר הוא שיתוף קובץ
 * הקו״ח (סגור כברירת מחדל). טיוטה ישנה שנשמרה עם הדגל הישן נשלחת בלי לשאת אותו.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";
const T = `${Date.now()}`.slice(-8);
const GROOM_LAST = `קשר${T}`;
const GROOM_PHONE = `058${T}8`;
const GROOM_STREET = `רחוב-קשר-${T}`;
const GROOM_CV = `https://example.test/cv-private-${T}.pdf`;
const LOAD_TIMEOUT = 20_000;

let admin: SupabaseClient;
let shadchanId: string;
let groomId = "";
let secondGroomId = "";
let brideId = "";
let draftId = "";

async function proposalFlags(groom: string) {
  const { data, error } = await admin
    .from("shidduchim")
    .select("status, share_cv, share_contact_details, share_medical_info")
    .eq("groom_id", groom)
    .eq("bride_id", brideId)
    .single();
  expect(error, error?.message).toBeNull();
  return data;
}

test.describe("פרטי התקשרות אינם נפתחים לצד השני", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    const managerId = await ensureCardManagerId(admin);
    const parentId = await ensureSecondParentId(admin);

    groomId = await createCard(admin, {
      userId: managerId,
      gender: "male",
      firstName: "חתן",
      lastName: GROOM_LAST,
    });
    secondGroomId = await createCard(admin, {
      userId: managerId,
      gender: "male",
      firstName: "חתן-שני",
      lastName: GROOM_LAST,
    });
    brideId = await createCard(admin, {
      userId: parentId,
      gender: "female",
      firstName: "כלה",
      lastName: GROOM_LAST,
    });
    const { error } = await admin
      .from("students")
      .update({
        phone: GROOM_PHONE,
        street: GROOM_STREET,
        cv_url: GROOM_CV,
        parents_info: {
          father: { self: { name: "אב-קשר" }, phone: GROOM_PHONE },
        },
      })
      .eq("id", groomId);
    if (error) throw new Error(error.message);

    // טיוטה ישנה: נשמרה כשהדגל הישן עוד היה קיים בחלון
    draftId = await insertShidduch(admin, {
      groomId,
      brideId,
      shadchanId,
      status: "draft",
    });
    const legacy = await admin
      .from("shidduchim")
      .update({ share_contact_details: true })
      .eq("id", draftId);
    if (legacy.error) throw new Error(legacy.error.message);
  });

  test.afterAll(async () => {
    await deleteCards(admin, [groomId, secondGroomId, brideId].filter(Boolean));
  });

  test("חלון השליחה: אין בחירה בפרטי התקשרות; יש 'לשתף את קובץ הקו״ח', סגור כברירת מחדל", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/shadchan/drafts");
    await page.getByRole("button", { name: "עריכה ושליחה" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Assert
    await expect(dialog.locator("#share-contact")).toHaveCount(0);
    await expect(dialog.getByLabel(/פרטי התקשרות/)).toHaveCount(0);
    const shareCv = dialog.getByRole("checkbox", {
      name: "לשתף את קובץ הקו״ח",
    });
    await expect(shareCv).not.toBeChecked();
    await expect(dialog.locator("#share-cv-hint")).toContainText(
      "הקובץ עצמו עלול לכלול טלפון או כתובת",
    );
    await expect(dialog).toContainText(
      "טלפון, כתובת ופרטי הקשר של ההורים והממליצים אינם מוצגים לצד השני",
    );
    await expect(
      dialog.getByRole("checkbox", { name: "הצהרה רפואית" }),
    ).not.toBeChecked();

    // Act: שליחת הטיוטה הישנה, עם שיתוף הקו״ח
    await shareCv.check();
    const sent = page.waitForResponse((response) =>
      response.url().includes(OFFER_ENDPOINT),
    );
    await dialog.getByRole("button", { name: "שלח הצעה" }).click();
    const response = await sent;

    // Assert: הדגל הישן שעל הטיוטה אינו נשמר על ההצעה שנשלחה
    expect(response.status(), await response.text()).toBe(200);
    expect(await proposalFlags(groomId)).toEqual({
      status: "sent",
      share_cv: true,
      share_contact_details: false,
      share_medical_info: false,
    });
  });

  test("הנתיב מתעלם מ-shareContactDetails שלקוח ישן שולח, ו-shareCv סגור כברירת מחדל", async ({
    request,
  }) => {
    // Act
    const response = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: secondGroomId,
        brideId,
        action: "send",
        recipientScope: "both",
        shareContactDetails: true,
      },
    });

    // Assert
    expect(response.status(), await response.text()).toBe(200);
    expect(await proposalFlags(secondGroomId)).toEqual({
      status: "sent",
      share_cv: false,
      share_contact_details: false,
      share_medical_info: false,
    });
  });

  test("ההורה של הצד השני: רואה את קובץ הקו״ח ששותף, ולא טלפון או כתובת", async ({
    browser,
  }) => {
    // Arrange
    const parent = await pageAs(
      browser,
      admin,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );

    // Assert
    await expect(
      parent.getByRole("heading", { level: 1, name: new RegExp(GROOM_LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(parent.locator(`a[href="${GROOM_CV}"]`).first()).toBeVisible();
    await expect(parent.getByText(/פרטי ההתקשרות/)).toBeVisible();
    await expect(parent.locator('a[href^="tel:"]')).toHaveCount(0);
    const html = await (await parent.request.get(parent.url())).text();
    expect(html).not.toContain(GROOM_PHONE);
    expect(html).not.toContain(GROOM_STREET);

    // בלי שיתוף: גם הקו״ח אינו מגיע
    await parent.goto(`/app/students/${secondGroomId}`);
    await expect(
      parent.getByRole("heading", { level: 1, name: new RegExp(GROOM_LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(parent.locator('a[href*="cv-private"]')).toHaveCount(0);
    await parent.context().close();
  });
});
