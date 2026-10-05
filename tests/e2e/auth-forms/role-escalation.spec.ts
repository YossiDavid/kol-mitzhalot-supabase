import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * הפרצה שנסגרה: user_metadata ניתן לכתיבה ע"י המשתמש עצמו, ובעבר ממנו נקראו
 * התפקידים - כל משתמש מחובר יכול היה להריץ
 *   supabase.auth.updateUser({ data: { roles: ["admin"] } })
 * ולהפוך למנהל. התפקידים יושבים עכשיו ב-app_metadata (service role בלבד).
 *
 * הבדיקה מריצה את ההתקפה בפועל מול משתמש רגיל (עם הסשן שלו, ה-JWT שלו ואחרי
 * רענון הסשן), ומוודאת ש-API של מנהל, RLS ו-has_role כולם עדיין דוחים אותו.
 * היא בפרויקט auth-forms (בלי storageState): המשתמש כאן אינו משתמש הבדיקה
 * הרגיל (שהוא שדכן) אלא משתמש נפרד בלי שום תפקיד.
 */
const PLAIN_EMAIL = "playwright-role-escalation@kol-mitzhalot.test";
const PLAIN_PHONE = "+972500000013";
const PLAIN_FIRST_NAME = "Plain";
const PLAIN_LAST_NAME = "Attacker";

const admin = createServiceClient();
let plainUserId: string;

/** יוצר (או מאפס) משתמש רגיל: בלי תפקידים ב-app_metadata וב-user_metadata */
async function ensurePlainUser(): Promise<string> {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users.find((u) => u.email === PLAIN_EMAIL);

  const userMetadata = {
    firstName: PLAIN_FIRST_NAME,
    lastName: PLAIN_LAST_NAME,
    phone: PLAIN_PHONE,
    phone_verified: true,
  };

  let userId: string;
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...existing.app_metadata, roles: [] },
      user_metadata: userMetadata,
    });
    if (error) throw new Error(`איפוס משתמש הבדיקה נכשל: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: PLAIN_EMAIL,
      phone: PLAIN_PHONE,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: userMetadata,
    });
    if (error || !data.user) {
      throw new Error(`יצירת משתמש הבדיקה נכשלה: ${error?.message}`);
    }
    userId = data.user.id;
  }

  // שער השם של ה-proxy דורש שורת פרופיל
  await admin.from("user_profiles").upsert({
    id: userId,
    first_name: PLAIN_FIRST_NAME,
    last_name: PLAIN_LAST_NAME,
  });
  return userId;
}

async function createMagicLinkTokenHash(): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: PLAIN_EMAIL,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(`יצירת קישור כניסה נכשלה: ${error?.message}`);
  }
  return tokenHash;
}

/** לקוח מחובר כמשתמש הרגיל (RLS חל עליו), בדיוק כמו הדפדפן */
async function signedInPlainClient(): Promise<SupabaseClient> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.verifyOtp({
    token_hash: await createMagicLinkTokenHash(),
    type: "magiclink",
  });
  if (error) throw new Error(`כניסה כמשתמש רגיל נכשלה: ${error.message}`);
  return client;
}

/** ההתקפה עצמה, כפי שהיא רצה מהדפדפן, ואחריה רענון הסשן כדי לקבל JWT חדש */
async function escalateViaUserMetadata(client: SupabaseClient) {
  const { error: updateError } = await client.auth.updateUser({
    data: { roles: ["admin"], role: "admin" },
  });
  // הכתיבה ל-user_metadata עדיין מותרת למשתמש (זו לא הבעיה) - חשוב שהיא
  // הצליחה, אחרת הבדיקה לא הוכיחה כלום
  expect(updateError).toBeNull();

  const { data: refreshed, error: refreshError } =
    await client.auth.refreshSession();
  expect(refreshError).toBeNull();
  return refreshed.session!;
}

function decodeJwtPayload(accessToken: string): {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} {
  const payload = accessToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

test.describe("העלאת הרשאות דרך user_metadata (נסגרה)", () => {
  test.beforeEach(async () => {
    plainUserId = await ensurePlainUser();
  });

  test("ה-JWT אחרי ההתקפה נושא roles רק ב-user_metadata, וה-DB ו-RLS דוחים", async () => {
    // Arrange
    const client = await signedInPlainClient();

    // Act
    const session = await escalateViaUserMetadata(client);
    const claims = decodeJwtPayload(session.access_token);

    // Assert - ההזרקה אכן נכתבה ל-user_metadata ול-JWT...
    expect(claims.user_metadata?.roles).toEqual(["admin"]);
    // ...אבל app_metadata, המקור היחיד להרשאות, לא נגע
    expect(claims.app_metadata?.roles ?? []).not.toContain("admin");

    const { data: isAdmin } = await client.rpc("has_role", {
      uid: plainUserId,
      role_name: "admin",
    });
    expect(isAdmin).toBe(false);

    const { data: isAdminSelf } = await client.rpc("is_admin");
    expect(isAdminSelf).toBe(false);

    const { data: isShadchanOrAdmin } = await client.rpc(
      "is_shadchan_or_admin",
    );
    expect(isShadchanOrAdmin).toBe(false);
  });

  test("שורות shidduch_events (למנהלים בלבד) אינן נקראות אחרי ההתקפה", async () => {
    // Arrange - בלי שורות בטבלה הבדיקה לא הייתה מוכיחה כלום
    const { count } = await admin
      .from("shidduch_events")
      .select("id", { count: "exact", head: true });
    test.skip(
      !count,
      "אין שורות ב-shidduch_events - הרץ קודם בדיקות shidduchim",
    );

    const client = await signedInPlainClient();
    await escalateViaUserMetadata(client);

    // Act
    const { data, error } = await client.from("shidduch_events").select("id");

    // Assert - RLS מחזיר 0 שורות (או שגיאת הרשאה), לעולם לא את התוכן
    expect(error === null || typeof error.message === "string").toBe(true);
    expect(data ?? []).toHaveLength(0);
  });

  test("route של מנהל מחזיר 403 גם כש-user_metadata.roles הוא admin", async ({
    page,
  }) => {
    // Arrange - ההתקפה קודם; הכניסה לדפדפן אחריה (ה-JWT נושא roles ב-user_metadata)
    const client = await signedInPlainClient();
    await escalateViaUserMetadata(client);

    const tokenHash = await createMagicLinkTokenHash();
    await page.goto(
      `/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/app`,
    );
    await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

    // Act
    const rolesResponse = await page.request.patch(
      `/api/v1/admin/users/${plainUserId}/roles`,
      { data: { roles: ["admin"] } },
    );
    const settingsResponse = await page.request.get(
      "/api/v1/admin/system-settings/phone-verification",
    );

    // Assert
    expect(rolesResponse.status()).toBe(403);
    expect(settingsResponse.status()).toBe(403);

    const { data } = await admin.auth.admin.getUserById(plainUserId);
    expect(data.user?.app_metadata?.roles ?? []).toEqual([]);

    // וגם דף הניהול עצמו לא נפתח
    await page.goto("/app/admin");
    await expect(page).not.toHaveURL(/\/app\/admin(\/|$)/);
  });

  test('בקרת ביקורת: תפקיד שנכתב ל-app_metadata ע"י service role כן עובד', async () => {
    // Arrange
    const { data: before } = await admin.auth.admin.getUserById(plainUserId);
    const { error } = await admin.auth.admin.updateUserById(plainUserId, {
      app_metadata: { ...before.user?.app_metadata, roles: ["admin"] },
    });
    expect(error).toBeNull();

    // Act
    const client = await signedInPlainClient();
    const { data: isAdmin } = await client.rpc("has_role", {
      uid: plainUserId,
      role_name: "admin",
    });

    // Assert
    expect(isAdmin).toBe(true);
  });

  test.afterAll(async () => {
    // משאירים את המשתמש בלי תפקידים לריצות הבאות
    await ensurePlainUser();
  });
});
