/**
 * עזרים לבדיקות קוביות ההקדשה: סשנים אמיתיים (אנונימי / משתמש רגיל / מנהל),
 * וזריעה וניקוי של שורות בשירות (service role, עוקף RLS: להקמת מצב בלבד).
 * Callers: marketing/dedications-*.spec.ts, admin/dedications-admin.spec.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { DedicationKind } from "@/features/dedications/lib/dedication-model";
import { addDays, israelDateOf } from "@/features/dedications/lib/israel-date";

const AUTH_OPTIONS = {
  auth: { autoRefreshToken: false, persistSession: false },
};

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    AUTH_OPTIONS,
  );
}

export function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    AUTH_OPTIONS,
  );
}

export const PLAIN_USER = {
  email: "playwright-dedications-plain@kol-mitzhalot.test",
  phone: "+972500000061",
  roles: [] as string[],
};

export const ADMIN_USER = {
  email: "playwright-dedications-admin@kol-mitzhalot.test",
  phone: "+972500000062",
  roles: ["admin"],
};

type TestUserSpec = typeof PLAIN_USER;

/** יוצר (או מאפס תפקידים של) משתמש בדיקה קבוע */
async function ensureUser(spec: TestUserSpec): Promise<string> {
  const admin = serviceClient();
  const metadata = {
    firstName: "Dedications",
    lastName: spec.roles.length ? "Admin" : "Plain",
    phone: spec.phone,
    phone_verified: true,
  };
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users.find((user) => user.email === spec.email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...existing.app_metadata, roles: spec.roles },
      user_metadata: metadata,
    });
    if (error) throw new Error(`עדכון משתמש בדיקה נכשל: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      phone: spec.phone,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: { roles: spec.roles },
      user_metadata: metadata,
    });
    if (error || !data.user) {
      throw new Error(`יצירת משתמש בדיקה נכשלה: ${error?.message}`);
    }
    userId = data.user.id;
  }

  await admin.from("user_profiles").upsert({
    id: userId,
    first_name: metadata.firstName,
    last_name: metadata.lastName,
  });
  return userId;
}

/** לקוח מחובר כמשתמש הבדיקה (RLS חל עליו, כמו בדפדפן) */
export async function signedInClient(
  spec: TestUserSpec,
): Promise<SupabaseClient> {
  await ensureUser(spec);
  const { data, error: linkError } =
    await serviceClient().auth.admin.generateLink({
      type: "magiclink",
      email: spec.email,
    });
  const tokenHash = data?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error(`יצירת קישור כניסה נכשלה: ${linkError?.message}`);
  }

  const client = anonClient();
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error) throw new Error(`כניסה כמשתמש בדיקה נכשלה: ${error.message}`);
  return client;
}

export function israelToday(): string {
  return israelDateOf(new Date());
}

export { addDays };

export interface SeedRow {
  kind: DedicationKind;
  honoree: string;
  dedication_type?: string | null;
  donor_line?: string | null;
  note?: string | null;
  starts_on: string;
  ends_on: string | null;
  is_published?: boolean;
  sort_order?: number;
}

/** מכניס שורות בשירות ומחזיר את המזהים שלהן */
export async function seedDedications(
  rows: readonly SeedRow[],
): Promise<string[]> {
  const { data, error } = await serviceClient()
    .from("dedications")
    // כל השורות עם אותם מפתחות: הכנסה מרובה ממלאת חסרים ב-null ושוברת NOT NULL
    .insert(
      rows.map((row) => ({
        dedication_type: null,
        donor_line: null,
        note: null,
        is_published: true,
        sort_order: 0,
        ...row,
      })),
    )
    .select("id");
  if (error) throw new Error(`זריעת הקדשות נכשלה: ${error.message}`);
  return (data ?? []).map((row) => row.id as string);
}

/**
 * מוחק את כל השורות שהשם שלהן מכיל את סמן הריצה (גם אם הזריעה נכשלה באמצע).
 * "מכיל" ולא "מתחיל ב": שם שנראה כמו HTML מתחיל בתגית.
 */
export async function deleteDedicationsByPrefix(prefix: string): Promise<void> {
  const { error } = await serviceClient()
    .from("dedications")
    .delete()
    .like("honoree", `%${prefix}%`);
  if (error) throw new Error(`ניקוי הקדשות נכשל: ${error.message}`);
}
