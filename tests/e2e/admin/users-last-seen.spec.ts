import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * ניהול המשתמשים: "נראה לאחרונה" (user_profiles.last_seen_at, מתעדכן מה-proxy
 * דרך touch_last_seen), ו"שידוכים הוצעו" לפי יומן השליחות - הצעה שנשלחה לצד
 * אחד נספרת רק לצד שקיבל אותה.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const OTHER_SHADCHAN_EMAIL = "playwright-other-shadchan@kol-mitzhalot.test";

test.describe("ניהול משתמשים - נראה לאחרונה וספירת הצעות", () => {
  test.describe.configure({ mode: "serial" });

  let svc: SupabaseClient;
  let shadchanClient: SupabaseClient;
  let adminId: string;
  let shadchanId: string;
  let fx: ShidduchFixtures;

  const lastSeenOf = async (userId: string): Promise<string | null> => {
    const { data, error } = await svc
      .from("user_profiles")
      .select("last_seen_at")
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);
    return (data?.last_seen_at as string | null) ?? null;
  };

  const clearLastSeen = async (userId: string) => {
    await svc
      .from("user_profiles")
      .update({ last_seen_at: null })
      .eq("id", userId);
  };

  test.beforeAll(async () => {
    svc = createServiceClient();
    adminId = await getTestUserId(svc, ADMIN_EMAIL);
    shadchanId = await getTestUserId(svc);
    fx = await setupShidduchFixtures(svc);
    shadchanClient = await clientAs(svc, TEST_USER_EMAIL);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(svc, fx);
  });

  test("touch_last_seen מעדכנת רק את השורה של המשתמש, ואין כתיבה ישירה", async () => {
    // Arrange
    await clearLastSeen(shadchanId);
    await clearLastSeen(adminId);

    // Act
    const touch = await shadchanClient.rpc("touch_last_seen");
    const direct = await shadchanClient
      .from("user_profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", adminId)
      .select("id");

    // Assert
    expect(touch.error).toBeNull();
    expect(await lastSeenOf(shadchanId)).not.toBeNull();
    expect(direct.data ?? []).toEqual([]);
    expect(await lastSeenOf(adminId)).toBeNull();
  });

  test("ה-proxy מעדכן בגלישה, והעמוד מציג נראה לאחרונה (ובלעדיו - התחברות)", async ({
    page,
  }) => {
    // Arrange - העוגייה של ה-throttle לא קיימת בהקשר חדש
    await clearLastSeen(adminId);
    await clearLastSeen(fx.otherShadchanId);

    // Act
    await page.goto(`/app/admin/users/${adminId}`);

    // Assert - הגלישה עצמה עדכנה את המנהל
    await expect.poll(() => lastSeenOf(adminId)).not.toBeNull();
    await page.reload();
    await expect(page.getByTestId("last-seen")).toHaveAttribute(
      "data-source",
      "seen",
    );
    await expect(page.getByTestId("last-seen")).toHaveText(/עכשיו|לפני/);

    // Act - משתמש שלא נראה מאז העמודה: לפי ההתחברות האחרונה (אם יש)
    await page.goto(`/app/admin/users/${fx.otherShadchanId}`);
    const lastSeen = page.getByTestId("last-seen");
    if ((await lastSeen.count()) > 0) {
      await expect(lastSeen).toHaveAttribute("data-source", "sign-in");
    } else {
      await expect(page.getByText("לא נראה")).toBeVisible();
    }
  });

  test("שידוכים הוצעו: הצעה לצד אחד נספרת רק למקבל", async ({ page }) => {
    // Arrange - המיועדת שייכת לשדכן האחר; ההצעה נשלחה לצד המיועד בלבד
    await svc
      .from("students")
      .update({ user_id: fx.otherShadchanId })
      .eq("id", fx.brideFirst);
    const { error } = await svc.from("shidduchim").insert({
      groom_id: fx.groomFirst,
      bride_id: fx.brideFirst,
      shadchan_id: shadchanId,
      status: "sent",
      recipient_scope: "groom_only",
      sent_at: new Date().toISOString(),
    });
    expect(error).toBeNull();

    try {
      // Act
      await page.goto(
        `/app/admin/users?q=${encodeURIComponent(OTHER_SHADCHAN_EMAIL)}`,
      );

      // Assert - צד המיועדת לא קיבל הצעה
      await expect(
        page.getByTestId(`offered-count-${fx.otherShadchanId}`).first(),
      ).toHaveText("0");
      await expect(
        page.getByRole("columnheader", { name: "נראה לאחרונה" }),
      ).toBeVisible();
    } finally {
      await svc
        .from("students")
        .update({ user_id: fx.cardManagerId })
        .eq("id", fx.brideFirst);
    }
  });
});
