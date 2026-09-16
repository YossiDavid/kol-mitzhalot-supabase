import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  TEST_USER_EMAIL,
} from "../shidduchim/fixtures";

/**
 * טופס הגדרות הפרופיל אחרי המעבר ל-react-hook-form + zod
 * (docs/design-refactor/PLAN.md, שלב 3).
 *
 * הבדיקה משנה את השם של משתמש הבדיקה ומחזירה אותו לערכו המקורי ב-afterAll,
 * כדי שבדיקות אחרות (ושער השם ב-proxy) ימשיכו לראות את אותו משתמש.
 */
test.describe("הגדרות — טופס פרטים אישיים", () => {
  let admin: SupabaseClient;
  let userId: string;
  /** השם שהיה למשתמש לפני הבדיקה, כדי להחזיר אותו בסוף */
  let originalFirstName: string;
  let originalLastName: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    userId = await getTestUserId(admin, TEST_USER_EMAIL);
    const { data } = await admin.auth.admin.getUserById(userId);
    originalFirstName = (data.user?.user_metadata?.firstName as string) ?? "Test";
    originalLastName = (data.user?.user_metadata?.lastName as string) ?? "User";
  });

  test.afterAll(async () => {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        firstName: originalFirstName,
        lastName: originalLastName,
      },
    });
    await admin
      .from("user_profiles")
      .upsert({
        id: userId,
        first_name: originalFirstName,
        last_name: originalLastName,
      });
  });

  test("שדה חובה ריק נחסם עם הודעה בעברית", async ({ page }) => {
    // Arrange
    await page.goto("/app/settings");
    const firstName = page.getByLabel("שם פרטי");
    await expect(firstName).toBeVisible({ timeout: 15_000 });

    // Act
    await firstName.fill("");
    await page.getByRole("button", { name: "שמור שינויים" }).click();

    // Assert
    await expect(page.getByText("נא למלא שם פרטי")).toBeVisible();
  });

  test("טלפון לא תקין נחסם לפני השליחה", async ({ page }) => {
    // Arrange
    await page.goto("/app/settings");
    const phone = page.getByLabel("מספר טלפון");
    await expect(phone).toBeVisible({ timeout: 15_000 });

    // Act
    await phone.fill("12");
    await page.getByRole("button", { name: "שמור שינויים" }).click();

    // Assert
    await expect(
      page.getByText(
        "מספר טלפון לא תקין (7–15 ספרות, ניתן להוסיף קידומת בינלאומית עם +)",
      ),
    ).toBeVisible();
  });

  test("שמירת שם חדש מעדכנת את המשתמש", async ({ page }) => {
    // Arrange
    const newFirstName = `בדיקה${Date.now()}`;
    await page.goto("/app/settings");
    const firstName = page.getByLabel("שם פרטי");
    await expect(firstName).toBeVisible({ timeout: 15_000 });

    // Act
    await firstName.fill(newFirstName);
    await page.getByRole("button", { name: "שמור שינויים" }).click();

    // Assert
    await expect(page.getByText("הפרופיל עודכן בהצלחה")).toBeVisible({
      timeout: 15_000,
    });

    await expect
      .poll(
        async () => {
          const { data } = await admin.auth.admin.getUserById(userId);
          return data.user?.user_metadata?.firstName as string | undefined;
        },
        { timeout: 15_000 },
      )
      .toBe(newFirstName);
  });
});
