import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs, pageAs } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  deletePair,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * מנהל מערכת רשאי ליצור ולשלוח הצעה גם על כרטיס שטרם אושר על ידי ההנהלה.
 * במסד: בסשן של המנהל (is_admin) ובכתיבת ה-routes ב-service role על הצעה
 * שבבעלות מנהל. שדכן שאינו מנהל - חסום כמו קודם (במסד, ב-route ובלוח).
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";
const PAIR_STATUS_ENDPOINT = "/api/v1/shidduchim/pair-status";
const BLOCK_CODE = "card_pending_approval";

test.describe("הצעות על כרטיס שטרם אושר - מנהל מול שדכן", () => {
  test.describe.configure({ mode: "serial" });

  let svc: SupabaseClient;
  let adminClient: SupabaseClient;
  let shadchanClient: SupabaseClient;
  let adminId: string;
  let shadchanId: string;
  let fx: ShidduchFixtures;
  let previousFavorites: unknown;

  const pairRow = (
    shadchan: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    groom_id: fx.groomFirst,
    bride_id: fx.brideFirst,
    shadchan_id: shadchan,
    status: "draft",
    ...overrides,
  });

  const setAdminFavorites = async (ids: string[]) => {
    const { data } = await svc.auth.admin.getUserById(adminId);
    await svc.auth.admin.updateUserById(adminId, {
      user_metadata: { ...(data.user?.user_metadata ?? {}), favorites: ids },
    });
  };

  test.beforeAll(async () => {
    svc = createServiceClient();
    adminId = await getTestUserId(svc, ADMIN_EMAIL);
    shadchanId = await getTestUserId(svc);
    fx = await setupShidduchFixtures(svc);
    adminClient = await clientAs(svc, ADMIN_EMAIL);
    shadchanClient = await clientAs(svc, TEST_USER_EMAIL);
    const { data } = await svc.auth.admin.getUserById(adminId);
    previousFavorites = data.user?.user_metadata?.favorites;
    // המיועד הראשון ממתין לאישור ההנהלה
    const { error } = await svc
      .from("students")
      .update({ admin_approved_at: null })
      .eq("id", fx.groomFirst);
    if (error) throw new Error(error.message);
  });

  test.afterAll(async () => {
    await deletePair(svc, fx.groomFirst, fx.brideFirst);
    await setAdminFavorites(
      Array.isArray(previousFavorites) ? (previousFavorites as string[]) : [],
    );
    await teardownShidduchFixtures(svc, fx);
  });

  test.beforeEach(async () => {
    await deletePair(svc, fx.groomFirst, fx.brideFirst);
  });

  test("מסד: מנהל בסשן שלו יוצר טיוטה ושולח אותה", async () => {
    // Act
    const { data: draft, error: draftError } = await adminClient
      .from("shidduchim")
      .insert(pairRow(adminId))
      .select("id")
      .single();
    const send = await adminClient
      .from("shidduchim")
      .update({ status: "sent", recipient_scope: "both" })
      .eq("id", draft?.id ?? "");

    // Assert
    expect(draftError).toBeNull();
    expect(send.error).toBeNull();
  });

  test("מסד: service role (כמו ה-routes) - מותר להצעה של מנהל, חסום להצעה של שדכן", async () => {
    // Act
    const asAdminRow = await svc
      .from("shidduchim")
      .insert(pairRow(adminId, { status: "sent", recipient_scope: "both" }));
    await deletePair(svc, fx.groomFirst, fx.brideFirst);
    const asShadchanRow = await svc
      .from("shidduchim")
      .insert(pairRow(shadchanId));
    const shadchanDirect = await shadchanClient
      .from("shidduchim")
      .insert(pairRow(shadchanId));

    // Assert
    expect(asAdminRow.error).toBeNull();
    expect(asShadchanRow.error?.message).toBe(BLOCK_CODE);
    expect(shadchanDirect.error?.message).toBe(BLOCK_CODE);
  });

  test("route: מנהל - אין חסימה ב-pair-status, והטיוטה נשמרת", async ({
    request,
  }) => {
    // Act
    const status = await request.get(
      `${PAIR_STATUS_ENDPOINT}?groomId=${fx.groomFirst}&brideId=${fx.brideFirst}`,
    );
    const draft = await request.post(OFFER_ENDPOINT, {
      data: { groomId: fx.groomFirst, brideId: fx.brideFirst, action: "draft" },
    });

    // Assert
    expect(status.ok()).toBe(true);
    expect((await status.json()).blocks).toEqual([]);
    expect(draft.status()).toBe(200);
    expect((await draft.json()).status).toBe("draft");
  });

  test("route: שדכן שאינו מנהל - חסום ב-pair-status, בטיוטה ובשליחה", async ({
    browser,
  }) => {
    // Arrange
    const page = await pageAs(browser, svc, TEST_USER_EMAIL, "/app");

    try {
      // Act
      const status = await page.request.get(
        `${PAIR_STATUS_ENDPOINT}?groomId=${fx.groomFirst}&brideId=${fx.brideFirst}`,
      );
      const draft = await page.request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideFirst,
          action: "draft",
        },
      });
      const send = await page.request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideFirst,
          action: "send",
          recipientScope: "both",
        },
      });

      // Assert
      const blocks = (await status.json()).blocks as Array<{ code: string }>;
      expect(blocks.map((block) => block.code)).toContain(BLOCK_CODE);
      expect(draft.status()).toBe(409);
      expect((await draft.json()).code).toBe(BLOCK_CODE);
      expect(send.status()).toBe(409);
      expect((await send.json()).code).toBe(BLOCK_CODE);
    } finally {
      await page.context().close();
    }
  });

  test("לוח עבודה של מנהל: כרטיס ממתין אינו עולה ללוח; אחרי אישור 'להצעות ממני בלבד' - עולה, והשמירה והשליחה פתוחות", async ({
    page,
  }) => {
    // Arrange
    await setAdminFavorites([fx.groomFirst, fx.brideFirst]);

    // Act + Assert: ממתין - לא בלוח (אין כוכב לכרטיס שלא אושר להצעות)
    await page.goto("/app/canvas");
    await expect(
      page.getByRole("button", { name: "שיבוץ מיועדת ראשונה במשבצת המיועדת" }),
    ).toHaveCount(0, { timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "שיבוץ מיועד ראשון במשבצת המיועד" }),
    ).toHaveCount(0);

    // Act: אישור בלעדי למנהל
    const now = new Date().toISOString();
    const { error } = await svc
      .from("students")
      .update({ admin_approved_at: now, admin_exclusive_at: now })
      .eq("id", fx.groomFirst);
    expect(error).toBeNull();
    await page.goto("/app/canvas");
    await placePair(page);

    // Assert
    await expect(page.getByTestId("third-party-send-blocked")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "שלח הצעה" })).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "שמירה ללא שליחה" }),
    ).toBeEnabled();
  });
});

/** משבץ את המיועד הראשון ואת המיועדת הראשונה של הפיקסצ'ר */
async function placePair(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "שיבוץ מיועד ראשון במשבצת המיועד" })
    .click();
  await page.getByRole("tab", { name: "מיועדות" }).click();
  await page
    .getByRole("button", { name: "שיבוץ מיועדת ראשונה במשבצת המיועדת" })
    .click();
}
