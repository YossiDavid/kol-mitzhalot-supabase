/**
 * Callers: Playwright `chromium` project.
 * גודל המאגר ב"כלי שדכן" בדשבורד: "כרטיסים במאגר" ו"חדשים השבוע", עם קישור
 * לרשימה. הורה (בלי תפקיד שדכן/מנהל) לא רואה ספירות מאגר.
 */
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { approvedCard } from "../helpers/approved-card";
import { serviceClient } from "../helpers/dedications";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

const LOAD = { timeout: 15_000 };
const DESKTOP = { width: 1440, height: 900 };

test.use({ viewport: DESKTOP });

test.describe("ספירות מאגר בדשבורד", () => {
  const admin = createServiceClient();
  let studentId: string | null = null;
  let parentId: string | null = null;

  test.beforeAll(async () => {
    const userId = await getTestUserId(admin);
    const { data, error } = await admin
      .from("students")
      .insert(
        approvedCard({
          user_id: userId,
          first_name: "חדש",
          last_name: `השבוע${Date.now()}`,
          birth_date: "1998-01-01",
          gender: "male",
          personal_status: "single",
          country: "ישראל",
          city: "בני ברק",
          in_shidduchim: true,
          created_at: new Date().toISOString(),
        }),
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(`זריעה נכשלה: ${error?.message}`);
    studentId = data.id as string;
  });

  test.afterAll(async () => {
    if (studentId) await admin.from("students").delete().eq("id", studentId);
    if (parentId) await admin.auth.admin.deleteUser(parentId);
  });

  test("שדכן: רואה את הספירות, והן זהות לרשימה, והקישור מוביל אליה", async ({
    page,
  }) => {
    // Act
    await page.goto("/app");
    const counts = page.getByTestId("dashboard-pool-counts");
    await expect(counts).toBeVisible(LOAD);
    const dashboardTotal = Number(
      (await page.getByTestId("dashboard-pool-total").innerText()).replace(
        /\D/g,
        "",
      ),
    );
    const newThisWeek = Number(
      (await page.getByTestId("dashboard-pool-new").innerText()).replace(
        /\D/g,
        "",
      ),
    );

    // Assert
    expect(newThisWeek).toBeGreaterThanOrEqual(1);
    expect(dashboardTotal).toBeGreaterThanOrEqual(newThisWeek);
    await counts.click();
    await expect(page).toHaveURL(/\/app\/students$/);
    await expect(page.getByTestId("students-count-total")).toHaveAttribute(
      "data-total",
      String(dashboardTotal),
      LOAD,
    );
  });

  test("הורה: לא רואה ספירות מאגר", async ({ browser }) => {
    // Arrange: משתמש בלי תפקיד, בסשן נפרד
    const email = `pool-parent-${randomUUID()}@kol-mitzhalot.test`;
    const phone = `+9725${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const { data, error } = await serviceClient().auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        firstName: "הורה",
        lastName: "בדיקה",
        phone,
        phone_verified: true,
      },
    });
    if (error || !data.user) throw new Error("יצירת הורה נכשלה");
    parentId = data.user.id;
    await serviceClient()
      .from("user_profiles")
      .upsert({ id: parentId, first_name: "הורה", last_name: "בדיקה" });
    const { data: link } = await serviceClient().auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    try {
      // Act
      await page.goto(
        `/auth/confirm?token_hash=${link?.properties?.hashed_token}&type=magiclink&next=/app`,
      );
      await page
        .getByRole("button", { name: "לחצו כדי להיכנס למערכת" })
        .click();
      await expect(page).toHaveURL((url) => url.pathname === "/app", LOAD);

      // Assert: הדשבורד נטען, ואין ספירות מאגר
      await expect(page.getByText(/ברוך הבא למערכת קול מצהלות/)).toBeAttached(
        LOAD,
      );
      await expect(page.getByTestId("dashboard-pool-counts")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
