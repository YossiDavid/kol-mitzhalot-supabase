import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * מזהי הזרע המקומי (supabase/seed.sql). הם קבועים בקובץ הזרע, ולכן הבדיקות
 * מסתמכות עליהם ישירות במקום לחפש רשומות לפי שם.
 */
export const SEED = {
  /** shadchan@local.test — הבעלים של הטיוטה שבזרע */
  shadchanUserId: "22222222-2222-2222-2222-222222222222",
  groomFirst: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  groomSecond: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  brideFirst: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  brideSecond: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  /** טיוטה קיימת של shadchan@local.test לצמד groomFirst + brideFirst */
  existingDraftId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
} as const;

/** אותה ברירת מחדל כמו ב-tests/e2e/auth.setup.ts */
export const TEST_USER_EMAIL =
  process.env.TEST_USER_EMAIL ?? "playwright-test@kol-mitzhalot.test";

export type ShidduchStatusValue = "draft" | "sent" | "rejected";

export interface ShidduchRow {
  id: string;
  groom_id: string;
  bride_id: string;
  shadchan_id: string;
  status: string;
  note_for_groom: string | null;
  note_for_bride: string | null;
  recipient_scope: string | null;
  sent_at: string | null;
}

interface InsertShidduchParams {
  groomId: string;
  brideId: string;
  shadchanId: string;
  status?: ShidduchStatusValue;
  noteForGroom?: string;
  noteForBride?: string;
}

const SHIDDUCH_COLUMNS =
  "id, groom_id, bride_id, shadchan_id, status, note_for_groom, note_for_bride, recipient_scope, sent_at";

/**
 * לקוח service role — עוקף RLS. משמש להכנת מצב ולאימות מצב בלבד, לעולם לא
 * כתחליף לבקשה שהבדיקה אמורה לבדוק.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY חסרים — ראה tests/load-env.ts",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getTestUserId(
  admin: SupabaseClient,
  email: string = TEST_USER_EMAIL,
): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    throw new Error(`קריאת רשימת המשתמשים נכשלה: ${error.message}`);
  }

  const found = data.users.find((user) => user.email === email);
  if (!found) {
    throw new Error(`משתמש הבדיקה ${email} לא נמצא — האם auth.setup רץ?`);
  }

  return found.id;
}

export async function insertShidduch(
  admin: SupabaseClient,
  params: InsertShidduchParams,
): Promise<string> {
  const { data, error } = await admin
    .from("shidduchim")
    .insert({
      groom_id: params.groomId,
      bride_id: params.brideId,
      shadchan_id: params.shadchanId,
      status: params.status ?? "draft",
      note_for_groom: params.noteForGroom ?? null,
      note_for_bride: params.noteForBride ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `הכנת רשומת שידוך לבדיקה נכשלה: ${error?.message ?? "לא הוחזרה שורה"}`,
    );
  }

  return data.id as string;
}

export async function getShidduch(
  admin: SupabaseClient,
  id: string,
): Promise<ShidduchRow | null> {
  const { data, error } = await admin
    .from("shidduchim")
    .select(SHIDDUCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`קריאת רשומת השידוך נכשלה: ${error.message}`);
  }

  return (data as ShidduchRow | null) ?? null;
}

/** כמה שורות קיימות לצמד — unique_shidduch_pair מתיר אחת בלבד */
export async function countPairRows(
  admin: SupabaseClient,
  groomId: string,
  brideId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("shidduchim")
    .select("id", { count: "exact", head: true })
    .eq("groom_id", groomId)
    .eq("bride_id", brideId);

  if (error) {
    throw new Error(`ספירת שורות הצמד נכשלה: ${error.message}`);
  }

  return count ?? 0;
}

/** ניקוי אחרי בדיקה — הבדיקות מייצרות שורות אמיתיות במסד המקומי */
export async function deletePair(
  admin: SupabaseClient,
  groomId: string,
  brideId: string,
): Promise<void> {
  const { error } = await admin
    .from("shidduchim")
    .delete()
    .eq("groom_id", groomId)
    .eq("bride_id", brideId);

  if (error) {
    throw new Error(`ניקוי שורות הצמד נכשל: ${error.message}`);
  }
}
