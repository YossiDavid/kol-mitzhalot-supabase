import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "../shidduchim/fixtures";
import { createUserSessionClient } from "../forums/forum-fixtures";
import {
  COMPLETE_IDENTITY_COLUMNS,
  fillShadchanIdentity,
} from "../helpers/shadchan-form";

/**
 * בקשת הצטרפות כשדכן: טלפון, קהילה ורב בית הכנסת הם שדות חובה - בטופס
 * ובמסד (הטריגר guard_application_decision). בקשה ישנה בלי השדות נטענת
 * כרגיל, ונדרש למלא אותם רק בהגשה הבאה.
 *
 * משתמש הבדיקה הרגיל הוא שדכן ומוּפנה מהטופס, ולכן כאן נוצר מגיש נפרד
 * שנכנס בדפדפן ללא ה-storageState.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const EMAIL = `shadchan-fields-${RUN_ID}@kol-mitzhalot.test`;
const PHONE_MESSAGE = "נא למלא טלפון ליצירת קשר";
const COMMUNITY_MESSAGE = "נא לבחור קהילה / חסידות";
const RABBI_MESSAGE = "נא למלא רב בית הכנסת שלך";
const RABBI_NAME = "הרב בדיקה שלום";

const admin = createServiceClient();
let applicantId = "";

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    phone: `+9725${String(RUN_ID).slice(-8)}`,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      firstName: "מגיש",
      lastName: "שדות",
      phone_verified: true,
    },
  });
  if (error || !data.user) throw new Error(`יצירת מגיש: ${error?.message}`);
  applicantId = data.user.id;
  await admin
    .from("user_profiles")
    .upsert({ id: applicantId, first_name: "מגיש", last_name: "שדות" });
});

test.afterAll(async () => {
  await admin.from("shadchanim_info").delete().eq("user_id", applicantId);
  await admin.auth.admin.deleteUser(applicantId);
});

test.beforeEach(async () => {
  await admin.from("shadchanim_info").delete().eq("user_id", applicantId);
});

async function signIn(page: Page) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  expect(error).toBeNull();
  await page.goto(
    `/auth/confirm?token_hash=${data?.properties?.hashed_token}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"), {
    timeout: LOAD_TIMEOUT,
  });
}

async function openForm(page: Page) {
  await signIn(page);
  await page.goto("/app/settings/shadchan");
  await expect(
    page.getByRole("heading", { name: "הצטרפות כשדכן", level: 1 }),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
}

async function fillBase(page: Page) {
  await page.getByLabel("ביוגרפיה").fill("שדכן בדיקה עם ניסיון");
  await page.getByLabel("שנות ניסיון").fill("3");
  await page.getByLabel("כמה שידוכים סגרתי").fill("2");
}

async function pickFirstCommunity(page: Page) {
  await page.locator("#community").click();
  await page.getByRole("option").first().click();
}

const stored = async (client: SupabaseClient) =>
  (
    await client
      .from("shadchanim_info")
      .select("contact_phone, community, synagogue_rabbi, application_status")
      .eq("user_id", applicantId)
      .maybeSingle()
  ).data;

test.describe("הצטרפות כשדכן - שדות חובה", () => {
  test("שליחה בלי טלפון, קהילה ורב נחסמת ולא נשמרת", async ({ page }) => {
    // Arrange
    await openForm(page);
    await fillBase(page);

    // Act
    await page.getByRole("button", { name: "שלח בקשה" }).click();

    // Assert
    await expect(page.getByText(PHONE_MESSAGE)).toBeVisible();
    await expect(page.getByText(COMMUNITY_MESSAGE)).toBeVisible();
    await expect(page.getByText(RABBI_MESSAGE)).toBeVisible();
    expect(await stored(admin)).toBeNull();
  });

  test("חסר רק הרב: רק הודעת הרב מוצגת", async ({ page }) => {
    // Arrange
    await openForm(page);
    await fillBase(page);
    await page.getByLabel("טלפון ליצירת קשר").fill("0501234567");
    await pickFirstCommunity(page);

    // Act
    await page.getByRole("button", { name: "שלח בקשה" }).click();

    // Assert
    await expect(page.getByText(RABBI_MESSAGE)).toBeVisible();
    await expect(page.getByText(PHONE_MESSAGE)).toHaveCount(0);
    await expect(page.getByText(COMMUNITY_MESSAGE)).toHaveCount(0);
    expect(await stored(admin)).toBeNull();
  });

  test("טלפון לא תקין נחסם", async ({ page }) => {
    // Arrange
    await openForm(page);
    await fillBase(page);
    await page.getByLabel("טלפון ליצירת קשר").fill("12");
    await page.getByLabel("רב בית הכנסת שלך").fill(RABBI_NAME);
    await pickFirstCommunity(page);

    // Act
    await page.getByRole("button", { name: "שלח בקשה" }).click();

    // Assert
    await expect(
      page.getByText("מספר טלפון לא תקין", { exact: false }),
    ).toBeVisible();
    expect(await stored(admin)).toBeNull();
  });

  test("מילוי כל שלושת השדות נשמר כבקשה ממתינה", async ({ page }) => {
    // Arrange
    await openForm(page);
    await fillBase(page);
    await page.getByLabel("טלפון ליצירת קשר").fill("0501234567");
    await page.getByLabel("רב בית הכנסת שלך").fill(RABBI_NAME);
    await pickFirstCommunity(page);
    await fillShadchanIdentity(page);

    // Act
    await page.getByRole("button", { name: "שלח בקשה" }).click();
    await expect(page).toHaveURL(/\/app\/settings$/, { timeout: LOAD_TIMEOUT });

    // Assert
    const row = await stored(admin);
    expect(row?.application_status).toBe("pending");
    expect(row?.contact_phone).toBe("0501234567");
    expect(row?.synagogue_rabbi).toBe(RABBI_NAME);
    expect(row?.community).toBeTruthy();
  });

  test("בקשה ישנה בלי השדות נטענת, ונדרש למלא אותם בהגשה הבאה", async ({
    page,
  }) => {
    // Arrange - בקשה שהוגשה לפני שהשדות נדרשו (נכתבת ב-service role)
    const { error } = await admin.from("shadchanim_info").insert({
      user_id: applicantId,
      application_status: "pending",
      bio: "ביוגרפיה ישנה",
      experience_years: 4,
      closed_matches: 1,
    });
    expect(error).toBeNull();

    // Act
    await openForm(page);

    // Assert - הטופס נטען עם הנתונים הישנים והשדות החדשים ריקים
    await expect(page.getByLabel("ביוגרפיה")).toHaveValue("ביוגרפיה ישנה");
    await expect(page.getByLabel("רב בית הכנסת שלך")).toHaveValue("");
    await page.getByRole("button", { name: "עדכן בקשה" }).click();
    await expect(page.getByText(RABBI_MESSAGE)).toBeVisible();
    await expect(page.getByText(PHONE_MESSAGE)).toBeVisible();
  });

  test("המסד עצמו דוחה הגשת בקשה (ממתינה) בלי שלושת השדות", async () => {
    // Arrange - סשן אמיתי של המגיש, בלי הטופס
    const session = await createUserSessionClient(admin, EMAIL);
    const complete = {
      user_id: applicantId,
      contact_phone: "0501234567",
      community: "בעלזא",
      synagogue_rabbi: RABBI_NAME,
      ...COMPLETE_IDENTITY_COLUMNS,
    };

    // Act
    const results = await Promise.all(
      (["contact_phone", "community", "synagogue_rabbi"] as const).map(
        async (missing) => {
          await admin
            .from("shadchanim_info")
            .delete()
            .eq("user_id", applicantId);
          const { error } = await session
            .from("shadchanim_info")
            .insert({ ...complete, [missing]: "  " });
          return error?.message;
        },
      ),
    );

    // Assert
    for (const message of results) {
      expect(message).toBe("shadchan_application_incomplete");
    }
    await admin.from("shadchanim_info").delete().eq("user_id", applicantId);
    const ok = await session.from("shadchanim_info").insert(complete);
    expect(ok.error).toBeNull();
    expect((await stored(admin))?.application_status).toBe("pending");
  });

  test("אישור ודחייה בידי מנהל לא נחסמים גם בבקשה ישנה בלי השדות", async () => {
    // Arrange
    await admin.from("shadchanim_info").insert({
      user_id: applicantId,
      application_status: "pending",
    });

    // Act - service role (כמו נתיבי האישור והדחייה)
    const rejected = await admin
      .from("shadchanim_info")
      .update({ application_status: "rejected", rejected_reason: "בדיקה" })
      .eq("user_id", applicantId);
    const approved = await admin
      .from("shadchanim_info")
      .update({ application_status: "approved" })
      .eq("user_id", applicantId);

    // Assert
    expect(rejected.error).toBeNull();
    expect(approved.error).toBeNull();
  });
});
