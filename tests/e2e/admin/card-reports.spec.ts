import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * דף הדיווחים על כרטיסים (/app/admin/card-reports) והשהיית כרטיס מהכרטיס
 * עצמו. הדיווחים נזרעים ב-service role; ספירות לוח הבקרה נבדקות מול המסד
 * ובשינוי (דלתא), כי סוכנים אחרים יכולים להזיז מספרים מוחלטים.
 */
test.describe("דיווחים על כרטיסים (ניהול)", () => {
  test.describe.configure({ mode: "serial" });

  let db: SupabaseClient;
  let fx: ShidduchFixtures;
  let reportId: string;

  const openCount = async () => {
    const { count } = await db
      .from("card_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    return count ?? 0;
  };

  test.beforeAll(async () => {
    db = createServiceClient();
    fx = await setupShidduchFixtures(db);
    const { data, error } = await db
      .from("card_reports")
      .insert({
        student_id: fx.groomFirst,
        reporter_id: fx.otherShadchanId,
        reason: "other",
        details: "פירוט-דיווח-ניהול",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    reportId = data!.id as string;
  });

  test.afterAll(async () => {
    await db.from("card_reports").delete().eq("student_id", fx.groomFirst);
    await db
      .from("students")
      .update({ admin_paused_at: null, admin_paused_by: null })
      .eq("id", fx.groomFirst);
    await teardownShidduchFixtures(db, fx);
  });

  test("הדיווח מופיע בדף, ומסומן כטופל - עובר לטופלו וסופר בלוח הבקרה", async ({
    page,
  }) => {
    // Arrange
    const before = await openCount();
    await page.goto("/app/admin");
    await expect(page.getByTestId("pending-count-cardReports")).toHaveText(
      String(before),
      { timeout: 15_000 },
    );

    // Act - הדף
    await page.goto("/app/admin/card-reports");

    // Assert
    const row = page.getByRole("row").filter({ hasText: "פירוט-דיווח-ניהול" });
    await expect(row).toContainText("אחר");
    await expect(
      row.getByRole("link", { name: /מיועד ראשון/ }),
    ).toHaveAttribute("href", `/app/students/${fx.groomFirst}`);

    // Act - סימון כטופל
    const handleResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/v1/admin/card-reports/${reportId}`),
    );
    await page
      .locator(`[data-testid="card-report-handle-${reportId}"]:visible`)
      .click();
    const handleResult = await handleResponse;
    expect(handleResult.status(), await handleResult.text()).toBe(200);

    // Assert
    await expect(row).toHaveCount(0);
    const { data: handled } = await db
      .from("card_reports")
      .select("status, handled_by, handled_at")
      .eq("id", reportId)
      .single();
    expect(handled?.status).toBe("handled");
    expect(handled?.handled_by).not.toBeNull();
    expect(handled?.handled_at).not.toBeNull();
    expect(await openCount()).toBe(before - 1);

    await page.getByTestId("card-reports-tab-handled").click();
    await expect(
      page.getByRole("row").filter({ hasText: "פירוט-דיווח-ניהול" }),
    ).toBeVisible();

    await page.goto("/app/admin");
    await expect(page.getByTestId("pending-count-cardReports")).toHaveText(
      String(await openCount()),
      { timeout: 15_000 },
    );
  });

  test("השהיית הכרטיס מדף הדיווחים, עם אישור", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/card-reports?status=handled");

    // Act
    await page
      .locator(`[data-testid="card-report-pause-${reportId}"]:visible`)
      .click();
    await page.getByRole("button", { name: "השהה כרטיס" }).click();

    // Assert
    await expect(
      page.locator(`[data-testid="card-report-pause-${reportId}"]:visible`),
    ).toHaveText("ביטול השהיה");
    const { data } = await db
      .from("students")
      .select("admin_paused_at")
      .eq("id", fx.groomFirst)
      .single();
    expect(data?.admin_paused_at).not.toBeNull();
    await db
      .from("students")
      .update({ admin_paused_at: null, admin_paused_by: null })
      .eq("id", fx.groomFirst);
  });

  test("מנהל משהה ומבטל השהיה מהכרטיס עצמו, עם אישור וחיווי", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${fx.groomFirst}`);
    const banner = page.getByTestId("card-admin-paused-banner");
    await expect(page.locator("h1")).toBeVisible();
    await expect(banner).toHaveCount(0);

    // Act - השהיה; הדיאלוג מבקש אישור ואינו משהה לפני כן
    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await page.getByRole("menuitem", { name: "השהיית הכרטיס" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("השהיית הכרטיס");
    await dialog.getByRole("button", { name: "ביטול" }).click();
    expect(
      (
        await db
          .from("students")
          .select("admin_paused_at")
          .eq("id", fx.groomFirst)
          .single()
      ).data?.admin_paused_at,
    ).toBeNull();

    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await page.getByRole("menuitem", { name: "השהיית הכרטיס" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "השהה כרטיס" })
      .click();

    // Assert
    await expect(banner).toBeVisible();
    const { data: paused } = await db
      .from("students")
      .select("admin_paused_at, in_shidduchim")
      .eq("id", fx.groomFirst)
      .single();
    expect(paused?.admin_paused_at).not.toBeNull();
    expect(paused?.in_shidduchim).toBe(false);

    // Act - ביטול
    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await page.getByRole("menuitem", { name: "ביטול השהיה" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "ביטול השהיה" })
      .click();

    // Assert
    await expect(banner).toHaveCount(0);
    const { data: resumed } = await db
      .from("students")
      .select("admin_paused_at")
      .eq("id", fx.groomFirst)
      .single();
    expect(resumed?.admin_paused_at).toBeNull();
  });
});
