import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  deletePair,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * לכהן לא מציעים גרושה: מיועד שסומן כהן אינו מוצע למיועדת גרושה. נאכף
 * בטריגר (גם service role וגם כתיבה ישירה של שדכן), בנתיבי ההצעה (קוד
 * kohen_divorced), ובלוח העבודה (אזהרה חמורה וכפתורים חסומים). טיוטה שנשמרה
 * לפני שהמיועדת הפכה לגרושה - נחסמת בשליחה; הצעה שכבר נשלחה ממשיכה להתקדם.
 */
const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";
const SEND_OTHER_SIDE_ENDPOINT = "/api/v1/shidduchim/send-other-side";
const PAIR_STATUS_ENDPOINT = "/api/v1/shidduchim/pair-status";
const BLOCK_CODE = "kohen_divorced";
const BLOCK_MESSAGE = "לא ניתן להציע מיועדת גרושה למיועד כהן.";

test.describe("כלל כהן וגרושה", () => {
  test.describe.configure({ mode: "serial" });

  let svc: SupabaseClient;
  let shadchan: SupabaseClient;
  let shadchanId: string;
  let fx: ShidduchFixtures;
  let previousFavorites: unknown;

  const setCards = async (opts: { kohen: boolean; divorced: boolean }) => {
    const [groom, bride] = await Promise.all([
      svc
        .from("students")
        .update({ is_kohen: opts.kohen })
        .eq("id", fx.groomFirst),
      svc
        .from("students")
        .update({ personal_status: opts.divorced ? "divorced" : "single" })
        .eq("id", fx.brideFirst),
    ]);
    if (groom.error || bride.error) {
      throw new Error(groom.error?.message ?? bride.error?.message);
    }
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    groom_id: fx.groomFirst,
    bride_id: fx.brideFirst,
    shadchan_id: shadchanId,
    status: "draft",
    ...overrides,
  });

  const setFavorites = async (ids: string[]) => {
    const { data } = await svc.auth.admin.getUserById(shadchanId);
    await svc.auth.admin.updateUserById(shadchanId, {
      user_metadata: { ...(data.user?.user_metadata ?? {}), favorites: ids },
    });
  };

  test.beforeAll(async () => {
    svc = createServiceClient();
    shadchanId = await getTestUserId(svc);
    fx = await setupShidduchFixtures(svc);
    shadchan = await clientAs(svc, TEST_USER_EMAIL);
    const { data } = await svc.auth.admin.getUserById(shadchanId);
    previousFavorites = data.user?.user_metadata?.favorites;
  });

  test.afterAll(async () => {
    await deletePair(svc, fx.groomFirst, fx.brideFirst);
    await setFavorites(
      Array.isArray(previousFavorites) ? (previousFavorites as string[]) : [],
    );
    await teardownShidduchFixtures(svc, fx);
  });

  test.beforeEach(async () => {
    await deletePair(svc, fx.groomFirst, fx.brideFirst);
    await setCards({ kohen: true, divorced: true });
  });

  test("מסד: אין הצעה (גם לא טיוטה) - לא ב-service role ולא בכתיבה ישירה של שדכן", async () => {
    // Act
    const asService = await svc.from("shidduchim").insert(row());
    const asShadchan = await shadchan.from("shidduchim").insert(row());

    // Assert
    expect(asService.error?.message).toBe(BLOCK_CODE);
    expect(asShadchan.error?.message).toBe(BLOCK_CODE);
  });

  test("מסד: מיועד שאינו כהן, או מיועדת שאינה גרושה - מותר", async () => {
    // Arrange
    await setCards({ kohen: false, divorced: true });

    // Act
    const notKohen = await svc.from("shidduchim").insert(row());

    // Assert
    expect(notKohen.error).toBeNull();
  });

  test("מסד: טיוטה מלפני שהמיועדת הפכה לגרושה נחסמת בשליחה; הצעה שנשלחה ממשיכה", async () => {
    // Arrange - טיוטה והצעה שנשלחה לצד אחד, כשהמיועדת עוד רווקה
    await setCards({ kohen: true, divorced: false });
    const { data: draft, error } = await svc
      .from("shidduchim")
      .insert(row())
      .select("id")
      .single();
    expect(error).toBeNull();
    await setCards({ kohen: true, divorced: true });

    // Act - שליחת הטיוטה
    const send = await shadchan
      .from("shidduchim")
      .update({ status: "sent", recipient_scope: "both" })
      .eq("id", draft!.id);

    // Assert
    expect(send.error?.message).toBe(BLOCK_CODE);

    // Arrange - הצעה שכבר נשלחה (לפני השינוי) ומתקדמת בסטטוס
    await setCards({ kohen: true, divorced: false });
    await svc
      .from("shidduchim")
      .update({
        status: "sent",
        recipient_scope: "groom_only",
        sent_at: new Date().toISOString(),
      })
      .eq("id", draft!.id);
    await setCards({ kohen: true, divorced: true });

    // Act
    const progress = await svc
      .from("shidduchim")
      .update({ status: "interested" })
      .eq("id", draft!.id);
    const otherSide = await svc
      .from("shidduchim")
      .update({ recipient_scope: "both" })
      .eq("id", draft!.id);

    // Assert - התקדמות מותרת, שליחה לצד נוסף לא
    expect(progress.error).toBeNull();
    expect(otherSide.error?.message).toBe(BLOCK_CODE);
  });

  test("route offer: טיוטה ושליחה נדחות ב-409 עם הקוד וההסבר", async ({
    request,
  }) => {
    // Act
    const draft = await request.post(OFFER_ENDPOINT, {
      data: { groomId: fx.groomFirst, brideId: fx.brideFirst, action: "draft" },
    });
    const send = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        action: "send",
        recipientScope: "both",
      },
    });

    // Assert
    for (const response of [draft, send]) {
      expect(response.status()).toBe(409);
      expect(await response.json()).toEqual({
        error: BLOCK_MESSAGE,
        code: BLOCK_CODE,
        sides: ["bride"],
      });
    }
    const { count } = await svc
      .from("shidduchim")
      .select("id", { count: "exact", head: true })
      .eq("groom_id", fx.groomFirst)
      .eq("bride_id", fx.brideFirst);
    expect(count).toBe(0);
  });

  test("route send-other-side: השלמת השליחה לצד השני נחסמת", async ({
    request,
  }) => {
    // Arrange - נשלחה למיועד בלבד כשהמיועדת עוד רווקה
    await setCards({ kohen: true, divorced: false });
    const { data: sent } = await svc
      .from("shidduchim")
      .insert(
        row({
          status: "sent",
          recipient_scope: "groom_only",
          sent_at: new Date().toISOString(),
        }),
      )
      .select("id")
      .single();
    await setCards({ kohen: true, divorced: true });

    // Act
    const response = await request.post(SEND_OTHER_SIDE_ENDPOINT, {
      data: { shidduchId: sent!.id },
    });

    // Assert
    expect(response.status()).toBe(409);
    expect((await response.json()).code).toBe(BLOCK_CODE);
  });

  test("route pair-status: מחזיר את החסימה ללוח", async ({ request }) => {
    // Act
    const response = await request.get(
      `${PAIR_STATUS_ENDPOINT}?groomId=${fx.groomFirst}&brideId=${fx.brideFirst}`,
    );

    // Assert
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.blocks).toContainEqual({
      code: BLOCK_CODE,
      side: "bride",
      message: BLOCK_MESSAGE,
    });
  });

  test("לוח עבודה: אזהרה חמורה, ושליחה ושמירה חסומות", async ({ page }) => {
    // Arrange
    await setFavorites([fx.groomFirst, fx.brideFirst]);

    // Act
    await page.goto("/app/canvas");
    await placePair(page);

    // Assert
    const blockers = page.getByTestId("compatibility-blockers");
    await expect(blockers).toBeVisible();
    await expect(blockers).toContainText(BLOCK_MESSAGE);
    await expect(page.getByRole("button", { name: "שלח הצעה" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "שמירה ללא שליחה" }),
    ).toBeDisabled();
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
