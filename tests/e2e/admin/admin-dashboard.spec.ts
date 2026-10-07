/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * לוח הבקרה (/app/admin): "ממתין לטיפולך" ו"במבט חטוף". הנתונים נזרעים
 * בשירות (service role); המספר בדף חייב להיות שווה לספירה לפי אותה הגדרה.
 */
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "../shidduchim/fixtures";

const LOAD = { timeout: 15_000 };
const RUN = `dash${Date.now()}`;

const pendingCount = (page: Page, key: string) =>
  page.getByTestId(`pending-count-${key}`);

test.describe("לוח הבקרה (ניהול)", () => {
  let db: SupabaseClient;
  const submissionIds: string[] = [];
  const engagementIds: string[] = [];

  test.beforeAll(async () => {
    db = createServiceClient();
    const { data: submission, error: submissionError } = await db
      .from("contact_submissions")
      .insert({
        type: "contact",
        name: `פונה ${RUN}`,
        email: `${RUN}@example.test`,
        status: "new",
      })
      .select("id")
      .single();
    expect(submissionError).toBeNull();
    submissionIds.push(submission!.id);

    const { data: engagement, error: engagementError } = await db
      .from("engagements")
      .insert({
        groom_name: `חתן ${RUN}`,
        bride_name: `כלה ${RUN}`,
        is_published: false,
      })
      .select("id")
      .single();
    expect(engagementError).toBeNull();
    engagementIds.push(engagement!.id);
  });

  test.afterAll(async () => {
    await db.from("contact_submissions").delete().in("id", submissionIds);
    await db.from("engagements").delete().in("id", engagementIds);
  });

  test("הפניות והמודעות הממתינות נספרות כמו בדפים שלהן, והקישורים נכונים", async ({
    page,
  }) => {
    // Arrange
    const { count: expectedSubmissions } = await db
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    const { count: expectedEngagements } = await db
      .from("engagements")
      .select("id", { count: "exact", head: true })
      .eq("is_published", false);

    // Act
    await page.goto("/app/admin");

    // Assert
    await expect(pendingCount(page, "submissions")).toHaveText(
      String(expectedSubmissions),
      LOAD,
    );
    expect(expectedSubmissions).toBeGreaterThanOrEqual(1);
    await expect(pendingCount(page, "engagements")).toHaveText(
      String(expectedEngagements),
    );
    expect(expectedEngagements).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("pending-submissions")).toHaveAttribute(
      "href",
      "/app/admin/content/submissions",
    );
    await expect(page.getByTestId("pending-engagements")).toHaveAttribute(
      "href",
      "/app/admin/content/engagements",
    );

    // Act
    await page.getByTestId("pending-submissions").click();

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/content\/submissions$/);
  });

  test("תור ריק מוצג מעומעם עם 'אין …'", async ({ page }) => {
    // Arrange - מסמנים את הפניות החדשות כנקראו, ומחזירים בסוף
    const { data: fresh } = await db
      .from("contact_submissions")
      .select("id")
      .eq("status", "new");
    const ids = (fresh ?? []).map((row) => row.id);
    await db
      .from("contact_submissions")
      .update({ status: "read" })
      .in("id", ids);

    try {
      // Act
      await page.goto("/app/admin");

      // Assert
      await expect(pendingCount(page, "submissions")).toHaveText("0", LOAD);
      await expect(page.getByTestId("pending-submissions")).toContainText(
        "אין פניות חדשות",
      );
    } finally {
      await db
        .from("contact_submissions")
        .update({ status: "new" })
        .in("id", ids);
    }
  });

  test("במבט חטוף: כל המספרים נטענים (לא '—')", async ({ page }) => {
    // Act
    await page.goto("/app/admin");

    // Assert
    const keys = [
      "users",
      "approvedShadchanim",
      "activeCards",
      "proposalsTotal",
      "proposalsRecent",
      "donationsThisMonth",
    ];
    for (const key of keys) {
      const tile = page.getByTestId(`glance-${key}`);
      await expect(tile).toBeVisible(LOAD);
      await expect(tile.locator("dd")).toHaveText(/^[\d,.\s]+$/);
    }
  });

  test("פעולות מהירות ופאנל ברכה", async ({ page }) => {
    // Act
    await page.goto("/app/admin");

    // Assert
    await expect(
      page.getByRole("heading", {
        name: /ברוך הבא למערכת הניהול של קול מצהלות/,
      }),
    ).toBeVisible(LOAD);
    await expect(
      page.getByRole("link", { name: "יצירת משתמש" }),
    ).toHaveAttribute("href", "/app/admin/users/create");
    await expect(page.getByRole("link", { name: "מאמר חדש" })).toHaveAttribute(
      "href",
      "/app/admin/content/articles/new",
    );
  });
});
