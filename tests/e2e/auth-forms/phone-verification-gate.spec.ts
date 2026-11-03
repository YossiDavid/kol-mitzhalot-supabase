import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { clientAs, pageAs } from "../chats/context-fixtures";
import {
  createAdminClient,
  createTestUser,
  deleteTestUserByEmail,
  type TestUser,
} from "./auth-test-helpers";

/**
 * שער אימות הטלפון סומך רק על app_metadata.verified_phone (נכתב בשרת), ולא
 * על user_metadata.phone_verified שהמשתמש כותב בעצמו מהדפדפן.
 */
let admin: SupabaseClient;
let user: TestUser;

async function setPhoneVerificationEnabled(value: boolean) {
  const { error } = await admin
    .from("system_settings")
    .upsert({ key: "phone_verification_enabled", value });
  if (error) throw new Error(error.message);
}

test.describe("שער אימות טלפון", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createAdminClient();
    user = await createTestUser();
    await setPhoneVerificationEnabled(true);
  });

  test.afterAll(async () => {
    await setPhoneVerificationEnabled(false);
    await deleteTestUserByEmail(user.email);
  });

  test("סימון עצמי ב-user_metadata אינו עוקף את האימות", async ({
    browser,
  }) => {
    // Arrange: המשתמש מסמן את עצמו "מאומת" עם המפתח הציבורי
    const own = await clientAs(admin, user.email);
    const forged = await own.auth.updateUser({
      data: { phone_verified: true },
    });
    expect(forged.error).toBeNull();

    // Act
    const page = await pageAs(browser, admin, user.email, "/app");

    // Assert
    await expect(page).toHaveURL(/\/auth\/verify-phone/);
    await page.context().close();
  });

  test("מספר שאומת בשרת פותח את /app, והחלפת מספר מחייבת אימות מחדש", async ({
    browser,
  }) => {
    // Arrange: אימות בשרת (כמו otp/verify)
    const { data } = await admin.auth.admin.getUserById(user.id);
    const phone = data.user?.user_metadata?.phone as string;
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { verified_phone: phone },
    });

    // Act + Assert: מאומת
    const verified = await pageAs(browser, admin, user.email, "/app");
    await expect(verified).not.toHaveURL(/\/auth\/verify-phone/);
    await verified.context().close();

    // Act: המשתמש מחליף מספר
    const own = await clientAs(admin, user.email);
    await own.auth.updateUser({ data: { phone: "0527777777" } });
    const changed = await pageAs(browser, admin, user.email, "/app");

    // Assert: התפקידים נשמרו, והשער דורש אימות למספר החדש
    const after = await admin.auth.admin.getUserById(user.id);
    expect(after.data.user?.app_metadata?.roles).toEqual(["shadchan"]);
    await expect(changed).toHaveURL(/\/auth\/verify-phone/);
    await changed.context().close();
  });
});
