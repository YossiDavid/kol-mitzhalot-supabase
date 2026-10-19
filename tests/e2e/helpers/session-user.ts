/**
 * משתמשי בדיקה זמניים עם סשן אמיתי: בדפדפן (הקשר נפרד) או כלקוח API (RLS
 * חל, כמו בדפדפן). וגם המתג של חסימת אישור התקנון בסביבת הבדיקות.
 * Callers: admin/terms-gate.spec.ts, settings/shadchan-avatar-rls.spec.ts.
 */
import { randomUUID } from "node:crypto";

import { expect, type Browser, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "./dedications";

export type SessionUser = { id: string; email: string };

const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 30_000 };

function randomPhone(): string {
  return `+9725${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

export async function createSessionUser({
  prefix,
  roles = [],
  metadata = {},
}: {
  prefix: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
}): Promise<SessionUser> {
  const admin = serviceClient();
  const email = `${prefix}-${randomUUID()}@kol-mitzhalot.test`;
  const phone = randomPhone();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles },
    user_metadata: {
      firstName: "בדיקה",
      lastName: prefix,
      phone,
      phone_verified: true,
      ...metadata,
    },
  });
  if (error || !data.user) {
    throw new Error(`יצירת משתמש נכשלה: ${error?.message}`);
  }
  await admin
    .from("user_profiles")
    .upsert({ id: data.user.id, first_name: "בדיקה", last_name: prefix });
  return { id: data.user.id, email };
}

export async function deleteSessionUsers(
  users: readonly SessionUser[],
): Promise<void> {
  const admin = serviceClient();
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

async function tokenHashFor(email: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error("יצירת קישור כניסה נכשלה");
  return tokenHash;
}

/** לקוח API מחובר כמשתמש (RLS חל עליו) */
export async function apiClientFor(user: SessionUser): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.verifyOtp({
    token_hash: await tokenHashFor(user.email),
    type: "magiclink",
  });
  if (error) throw new Error(`כניסה נכשלה: ${error.message}`);
  return client;
}

/** דף בהקשר נפרד, מחובר כמשתמש, אחרי נחיתה ב-/app */
export async function openPageAs(
  browser: Browser,
  user: SessionUser,
): Promise<Page> {
  const tokenHash = await tokenHashFor(user.email);
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.setViewportSize(DESKTOP);
  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/app", LOAD);
  return page;
}

/** מתג חסימת התקנון. בסביבת הבדיקות הוא כבוי (auth.setup.ts) */
export async function setTermsGateEnabled(isEnabled: boolean): Promise<void> {
  const { error } = await serviceClient()
    .from("system_settings")
    .upsert({ key: "terms_gate_enabled", value: isEnabled });
  if (error) throw new Error(`עדכון מתג התקנון נכשל: ${error.message}`);
}

export async function currentTermsVersion(): Promise<number> {
  const { data, error } = await serviceClient()
    .from("system_content")
    .select("version")
    .eq("key", "terms-of-service")
    .single();
  if (error || typeof data?.version !== "number") {
    throw new Error("קריאת גרסת התקנון נכשלה");
  }
  return data.version;
}

export async function seedTermsAcceptance(
  userId: string,
  version: number,
): Promise<void> {
  const { error } = await serviceClient()
    .from("terms_acceptances")
    .upsert({ user_id: userId, version }, { onConflict: "user_id,version" });
  if (error) throw new Error(`זריעת אישור תקנון נכשלה: ${error.message}`);
}
