import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * עזרים לבדיקות הכניסה במייל: יצירת משתמש זמני, קישור/קוד כמו שמייל היה
 * נושא, וקריאת מיילים אמיתיים מ-Mailpit של Supabase המקומי.
 *
 * הבדיקות רצות מול Supabase מקומי בלבד (assertLocalSupabase ב-playwright.config).
 */

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type TestUser = { id: string; email: string };

/** מספר טלפון ייחודי לכל משתמש (הטריגר דורש טלפון, והוא ייחודי) */
function randomPhone(): string {
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return `+9725${digits}`;
}

/** משתמש שיכול להגיע ל-/app: טלפון מאומת ושם מלא (דרישות ה-gates) */
export async function createTestUser(): Promise<TestUser> {
  const admin = createAdminClient();
  const email = `auth-link-${randomUUID()}@kol-mitzhalot.test`;
  const phone = randomPhone();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles: ["shadchan"] },
    user_metadata: {
      firstName: "Link",
      lastName: "Tester",
      phone,
      phone_verified: true,
    },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  await admin
    .from("user_profiles")
    .upsert({ id: data.user.id, first_name: "Link", last_name: "Tester" });
  await admin
    .from("system_settings")
    .upsert({ key: "phone_verification_enabled", value: false });

  return { id: data.user.id, email };
}

export async function deleteTestUserByEmail(email: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((candidate) => candidate.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

/** מה שמייל כניסה נושא: האסימון שבקישור והקוד בן הספרות */
export async function generateEmailCredentials(
  email: string,
): Promise<{ tokenHash: string; code: string }> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  const { hashed_token: tokenHash, email_otp: code } = data.properties;
  if (!tokenHash || !code) throw new Error("generateLink returned no token");
  return { tokenHash, code };
}

export function magicLinkPath(
  tokenHash: string,
  extra: { next?: string; type?: string } = {},
): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: extra.type ?? "magiclink",
  });
  if (extra.next) params.set("next", extra.next);
  return `/auth/confirm?${params.toString()}`;
}

type MailpitMessage = { ID: string };

/** המייל האחרון שנשלח לכתובת (Mailpit המקומי), או שגיאה אחרי המתנה */
async function readLatestEmailBody(
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = (await search.json()) as {
      messages?: MailpitMessage[];
    };
    const latest = messages?.[0];
    if (latest) {
      const response = await fetch(
        `${MAILPIT_URL}/api/v1/message/${latest.ID}`,
      );
      const message = (await response.json()) as { Text?: string };
      return message.Text ?? "";
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no email arrived for ${email}`);
}

/**
 * הקישור במייל כפי שהתבנית המקומית (ברירת המחדל של Supabase) שולחת אותו:
 * `{{ .ConfirmationURL }}` — כתובת האימות של Supabase עצמה. זו בדיוק הצורה
 * שמיילים בפרודקשן שולחים כשהתבנית שם לא הוחלפה.
 */
export async function readLatestEmailLink(email: string): Promise<string> {
  const body = await readLatestEmailBody(email);
  const match = /https?:\/\/[^\s)]+\/auth\/v1\/verify\?[^\s)]+/.exec(body);
  if (!match) throw new Error(`no sign-in link in the email for ${email}`);
  return match[0];
}

/** ממתין שמייל יגיע, בלי לקרוא ממנו כלום */
export async function waitForEmail(email: string): Promise<void> {
  await readLatestEmailBody(email);
}

/** נחיתה בנתיב מסוים, לפי ה-pathname בלבד (ה-query של הקישור כולל next=/app) */
export async function expectLandedOn(
  page: Page,
  pathPrefix: string,
): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname.startsWith(pathPrefix), {
    timeout: 15_000,
  });
}
