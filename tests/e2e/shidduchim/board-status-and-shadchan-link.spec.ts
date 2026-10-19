import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CARD_MANAGER_EMAIL, pageAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  deletePair,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * לוח העבודה מציג את מצב המועמד בכל כרטיס (לא פעיל, מושהה ע"י ההנהלה,
 * מאורס/נשוי, בתהליך), ושם השדכן בדף ההצעה של ההורה מקושר לדף השדכן.
 */
test.describe("לוח העבודה - מצב המועמד; דף ההצעה - קישור לשדכן", () => {
  test.describe.configure({ mode: "serial" });

  let svc: SupabaseClient;
  let shadchanId: string;
  let fx: ShidduchFixtures;
  let previousFavorites: unknown;
  let sentId = "";

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
    const { data } = await svc.auth.admin.getUserById(shadchanId);
    previousFavorites = data.user?.user_metadata?.favorites;

    // הצעות קודם (לפני שהכרטיסים מושהים): אחת שנשלחה, אחת "בתהליך"
    const sent = await svc
      .from("shidduchim")
      .insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideFirst,
        shadchan_id: shadchanId,
        status: "sent",
        recipient_scope: "both",
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (sent.error) throw new Error(sent.error.message);
    sentId = sent.data.id as string;
    const inProcess = await svc.from("shidduchim").insert({
      groom_id: fx.groomSecond,
      bride_id: fx.brideSecond,
      shadchan_id: fx.otherShadchanId,
      status: "in_progress",
    });
    if (inProcess.error) throw new Error(inProcess.error.message);

    const now = new Date().toISOString();
    await svc
      .from("students")
      .update({ in_shidduchim: false })
      .eq("id", fx.groomFirst);
    await svc
      .from("students")
      .update({ in_shidduchim: false, admin_paused_at: now })
      .eq("id", fx.groomSecond);
    await svc
      .from("students")
      .update({ personal_status: "engaged" })
      .eq("id", fx.brideFirst);
  });

  test.afterAll(async () => {
    await deletePair(svc, fx.groomFirst, fx.brideFirst);
    await deletePair(svc, fx.groomSecond, fx.brideSecond);
    await setFavorites(
      Array.isArray(previousFavorites) ? (previousFavorites as string[]) : [],
    );
    await teardownShidduchFixtures(svc, fx);
  });

  test("תגי מצב בכל כרטיס בלוח", async ({ page }) => {
    // Arrange
    await setFavorites([
      fx.groomFirst,
      fx.groomSecond,
      fx.brideFirst,
      fx.brideSecond,
    ]);

    // Act
    await page.goto("/app/canvas");

    // Assert - מיועדים
    await expect(statusOf(page, "מיועד ראשון", "inactive")).toHaveText(
      "לא פעיל בשידוכים",
    );
    await expect(statusOf(page, "מיועד שני", "admin_paused")).toHaveText(
      "מושהה ע״י ההנהלה",
    );
    await expect(statusOf(page, "מיועד שני", "in_process")).toHaveText(
      "בתהליך",
    );
    // השהיית הנהלה אינה מוצגת גם כ"לא פעיל"
    await expect(statusOf(page, "מיועד שני", "inactive")).toHaveCount(0);

    // Assert - מיועדות
    await page.getByRole("tab", { name: "מיועדות" }).click();
    await expect(statusOf(page, "מיועדת ראשונה", "engaged")).toHaveText(
      "מאורסת",
    );
    await expect(statusOf(page, "מיועדת שנייה", "in_process")).toBeVisible();
  });

  test("דף ההצעה של ההורה: שם השדכן מקושר לדף השדכן", async ({ browser }) => {
    // Arrange
    const parentPage = await pageAs(
      browser,
      svc,
      CARD_MANAGER_EMAIL,
      `/app/shidduchim/${sentId}`,
    );

    try {
      // Assert
      const link = parentPage.getByTestId("shadchan-name-link").first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute(
        "href",
        `/app/shadchanim/${shadchanId}`,
      );
    } finally {
      await parentPage.context().close();
    }
  });
});

function statusOf(page: Page, name: string, status: string) {
  return page
    .getByRole("group", { name: new RegExp(`^${name}\\.`) })
    .locator(`[data-status="${status}"]`);
}
