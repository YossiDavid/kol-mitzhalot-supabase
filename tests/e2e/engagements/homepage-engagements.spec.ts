import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * מודעות מאורסים בדף הבית: מוצגות חודש מיום הפרסום, עם קונפטי והזמנה
 * להצטרף. מודעה שממתינה לפרסום שולחת התראה למנהלים.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

test.describe("מודעות מאורסים בדף הבית", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let service: SupabaseClient;
  const stamp = Date.now();
  const recentGroom = `חתן חדש ${stamp}`;
  const oldGroom = `חתן ישן ${stamp}`;
  const createdIds: string[] = [];

  test.beforeAll(async () => {
    service = createServiceClient();
    const { data, error } = await service
      .from("engagements")
      .insert([
        {
          groom_name: recentGroom,
          bride_name: "כלה חדשה",
          is_published: true,
          source: "admin",
          // הכנסה מרובה ב-PostgREST: עמודה חסרה באחת השורות נשמרת NULL
          // ולא ברירת המחדל - לכן התאריך מפורש בשתיהן
          created_at: new Date().toISOString(),
        },
        {
          groom_name: oldGroom,
          bride_name: "כלה ישנה",
          is_published: true,
          source: "admin",
          created_at: new Date(Date.now() - 40 * DAY_MS).toISOString(),
        },
      ])
      .select("id");
    if (error || !data) throw new Error(`הכנת מודעות: ${error?.message}`);
    createdIds.push(...data.map((row) => row.id as string));
  });

  test.afterAll(async () => {
    if (createdIds.length) {
      await service.from("notifications").delete().in("related_id", createdIds);
      await service.from("engagements").delete().in("id", createdIds);
    }
  });

  test("מציג מודעה מהחודש האחרון ומסתיר מודעה ישנה", async ({ page }) => {
    await page.goto("/");
    const section = page.getByTestId("engagements-confetti");
    await expect(section).toContainText(recentGroom, { timeout: 30_000 });
    await expect(section).not.toContainText(oldGroom);
    await expect(page.getByTestId("engagements-signup-cta")).toHaveAttribute(
      "href",
      "/auth/sign-up",
    );
  });

  test("קונפטי פעם אחת בביקור כשהמדור נכנס למסך", async ({ page }) => {
    await page.goto("/");
    const section = page.getByTestId("engagements-confetti");
    await expect(section).toContainText(recentGroom, { timeout: 30_000 });
    await section.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.sessionStorage.getItem("website-engagements-confetti-seen"),
        ),
      )
      .toBe("1");
    // canvas-confetti מוסיף canvas לגוף הדף
    await expect(page.locator("body > canvas")).toHaveCount(1);
  });

  test("מודעה ממתינה לפרסום שולחת התראה למנהלים", async () => {
    const { data, error } = await service
      .from("engagements")
      .insert({
        groom_name: `חתן ממתין ${stamp}`,
        bride_name: "כלה ממתינה",
        source: "system",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת מודעה: ${error?.message}`);
    createdIds.push(data.id as string);

    const { data: notes } = await service
      .from("notifications")
      .select("type, link, body")
      .eq("related_id", data.id)
      .eq("type", "engagement_pending");
    expect(notes?.length ?? 0).toBeGreaterThan(0);
    expect(notes?.[0]?.link).toBe("/app/admin/content/engagements");
    expect(notes?.[0]?.body).toContain("שידוך שנסגר במערכת");
  });

  test("מודעה שהמנהל הוסיף לא שולחת התראה", async () => {
    const { data } = await service
      .from("notifications")
      .select("id")
      .in("related_id", createdIds.slice(0, 2))
      .eq("type", "engagement_pending");
    expect(data ?? []).toHaveLength(0);
  });
});
