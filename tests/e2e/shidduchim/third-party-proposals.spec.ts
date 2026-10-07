import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * הצעות וכרטיס צד שלישי: שליחה נחסמת (routes, טריגר במסד וכפתורים) עד
 * שמנהל אישר "אפשרות לשלוח הצעות" - מתג נפרד מ"הצגת נתונים מלאים".
 * כשאחד משני הכרטיסים חסום, כל השליחה נדחית. טיוטה מותרת, והצעות קיימות
 * אינן נפגעות.
 */
const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";
const SEND_OTHER_SIDE_ENDPOINT = "/api/v1/shidduchim/send-other-side";
const BLOCK_CODE = "card_third_party";
const BLOCK_MESSAGE =
  "לא ניתן לשלוח הצעה לכרטיס שמולא על ידי צד שלישי וטרם אושר לקבלת הצעות על ידי הנהלת המערכת. אפשר לפנות לממלא הכרטיס בצ'אט.";

test.describe("הצעות לכרטיס צד שלישי", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let shadchan: SupabaseClient;
  let shadchanId: string;
  let fx: ShidduchFixtures;
  let previousFavorites: unknown;

  const setApprovals = async (approvals: {
    display?: boolean;
    proposals?: boolean;
  }) => {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("students")
      .update({
        third_party_full_display_approved_at: approvals.display ? now : null,
        third_party_proposals_approved_at: approvals.proposals ? now : null,
      })
      .eq("id", fx.groomFirst);
    if (error) throw new Error(error.message);
  };

  const sendRow = (overrides: Record<string, unknown> = {}) => ({
    groom_id: fx.groomFirst,
    bride_id: fx.brideFirst,
    shadchan_id: shadchanId,
    status: "sent",
    recipient_scope: "both",
    sent_at: null,
    ...overrides,
  });

  const setFavorites = async (ids: string[]) => {
    const { data } = await admin.auth.admin.getUserById(shadchanId);
    await admin.auth.admin.updateUserById(shadchanId, {
      user_metadata: { ...(data.user?.user_metadata ?? {}), favorites: ids },
    });
  };

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    shadchan = await clientAs(admin, TEST_USER_EMAIL);
    const { data } = await admin.auth.admin.getUserById(shadchanId);
    previousFavorites = data.user?.user_metadata?.favorites;
    await admin
      .from("students")
      .update({ card_for: "other" })
      .eq("id", fx.groomFirst);
  });

  test.afterAll(async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await admin
      .from("students")
      .update({ card_for: null })
      .eq("id", fx.groomFirst);
    await setFavorites(
      Array.isArray(previousFavorites) ? (previousFavorites as string[]) : [],
    );
    await teardownShidduchFixtures(admin, fx);
  });

  test.beforeEach(async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await setApprovals({});
  });

  test("route offer: סירוב עם קוד, הצד החסום והסבר - גם כשההיקף הוא הצד השני", async ({
    request,
  }) => {
    // Act
    const both = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        action: "send",
        recipientScope: "both",
      },
    });
    const brideOnly = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        action: "send",
        recipientScope: "bride_only",
      },
    });

    // Assert
    expect(both.status()).toBe(409);
    expect(await both.json()).toEqual({
      error: BLOCK_MESSAGE,
      code: BLOCK_CODE,
      sides: ["groom"],
    });
    expect(brideOnly.status()).toBe(409);
    expect((await brideOnly.json()).code).toBe(BLOCK_CODE);
    const { count } = await admin
      .from("shidduchim")
      .select("id", { count: "exact", head: true })
      .eq("groom_id", fx.groomFirst);
    expect(count).toBe(0);
  });

  test("route offer: טיוטה נשמרת (ההגבלה חלה על שליחה בלבד)", async ({
    request,
  }) => {
    // Act
    const response = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        action: "draft",
      },
    });

    // Assert
    expect(response.status()).toBe(200);
    expect((await response.json()).status).toBe("draft");
  });

  test("route send-other-side: סירוב לכרטיס צד שלישי שלא אושר", async ({
    request,
  }) => {
    // Arrange - הצעה לצד אחד שנשלחה כשהכרטיס היה מאושר, ואז האישור בוטל
    await setApprovals({ proposals: true });
    const { error } = await shadchan
      .from("shidduchim")
      .insert(sendRow({ recipient_scope: "bride_only" }));
    expect(error).toBeNull();
    const { data: row } = await admin
      .from("shidduchim")
      .select("id")
      .eq("groom_id", fx.groomFirst)
      .single();
    await setApprovals({});

    // Act
    const response = await request.post(SEND_OTHER_SIDE_ENDPOINT, {
      data: { shidduchId: row?.id, note: "" },
    });

    // Assert
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.code).toBe(BLOCK_CODE);
    expect(body.sides).toEqual(["groom"]);
  });

  test("כתיבה ישירה לטבלה כשדכן: הטריגר מסרב, וטיוטה מותרת", async () => {
    // Act
    const send = await shadchan.from("shidduchim").insert(sendRow());
    const draft = await shadchan.from("shidduchim").insert({
      groom_id: fx.groomFirst,
      bride_id: fx.brideFirst,
      shadchan_id: shadchanId,
      status: "draft",
    });

    // Assert
    expect(send.error?.message).toContain(BLOCK_CODE);
    expect(draft.error).toBeNull();
  });

  test("אישור הצגה בלבד לא משחרר הצעות; אישור הצעות משחרר, בלי תלות בהצגה", async () => {
    // Arrange + Act
    await setApprovals({ display: true });
    const displayOnly = await shadchan.from("shidduchim").insert(sendRow());
    await setApprovals({ proposals: true });
    const proposalsOnly = await shadchan.from("shidduchim").insert(sendRow());

    // Assert
    expect(displayOnly.error?.message).toContain(BLOCK_CODE);
    expect(proposalsOnly.error).toBeNull();
  });

  test("מנהל הכרטיס וכל משתמש אחר אינם יכולים לשחרר את הנעילה בעצמם", async () => {
    // Act
    const forged = await shadchan
      .from("students")
      .update({ third_party_proposals_approved_at: new Date().toISOString() })
      .eq("id", fx.groomFirst);
    const { data } = await admin
      .from("students")
      .select("third_party_proposals_approved_at")
      .eq("id", fx.groomFirst)
      .single();

    // Assert - עדכון ללא הרשאה לא משנה דבר (RLS) או נדחה (טריגר)
    expect(data?.third_party_proposals_approved_at).toBeNull();
    if (forged.error) expect(forged.error.code).toMatch(/42501|P0001/);
  });

  test("טיוטה שמורה: עריכה ושליחה חסומה עם הסבר", async ({ page }) => {
    // Arrange
    await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId,
      status: "draft",
    });

    // Act
    await page.goto("/app/shadchan/drafts");
    await page.getByRole("button", { name: "עריכה ושליחה" }).first().click();

    // Assert
    await expect(page.getByTestId("send-proposal-blocked")).toHaveText(
      BLOCK_MESSAGE,
    );
    await expect(page.getByRole("button", { name: "שלח הצעה" })).toBeDisabled();
  });

  test("לוח עבודה: כפתור השליחה חסום עם הסבר, ומתאפשר אחרי אישור", async ({
    page,
  }) => {
    // Arrange
    await setFavorites([fx.groomFirst, fx.brideFirst]);
    await page.goto("/app/canvas");
    await placeBoth(page);

    // Assert - חסום
    await expect(page.getByTestId("third-party-send-blocked")).toHaveText(
      BLOCK_MESSAGE,
    );
    await expect(page.getByRole("button", { name: "שלח הצעה" })).toBeDisabled();
    await expect(
      page.getByTestId("third-party-card-tag").first(),
    ).toBeVisible();

    // Act - אישור, וטעינה מחדש של הלוח
    await setApprovals({ proposals: true });
    await page.goto("/app/canvas");
    await placeBoth(page);

    // Assert - פתוח
    await expect(page.getByTestId("third-party-send-blocked")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "שלח הצעה" })).toBeEnabled();
  });
});

/** משבץ את שני המועדפים (חתן וכלה) על הלוח */
async function placeBoth(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /^שיבוץ .* במשבצת המיועד$/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "מיועדות" }).click();
  await page
    .getByRole("button", { name: /^שיבוץ .* במשבצת המיועדת$/ })
    .first()
    .click();
}
