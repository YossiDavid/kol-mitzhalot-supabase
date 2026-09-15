import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/** המיועדים והמשתמשים שהבדיקות מקימות לעצמן */
export interface ShidduchFixtures {
  /** מנהל הכרטיסים של ארבעת המיועדים */
  cardManagerId: string;
  /** שדכן שאינו משתמש הבדיקה ואינו המנהל — לבדיקות בעלות וסירוב */
  otherShadchanId: string;
  groomFirst: string;
  groomSecond: string;
  brideFirst: string;
  brideSecond: string;
}

interface FixtureUser {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface InsertShidduchParams {
  groomId: string;
  brideId: string;
  shadchanId: string;
  status?: ShidduchStatusValue;
  noteForGroom?: string;
  noteForBride?: string;
}

interface CreateStudentParams {
  userId: string;
  gender: "male" | "female";
  firstName: string;
  lastName: string;
}

const SHIDDUCH_COLUMNS =
  "id, groom_id, bride_id, shadchan_id, status, note_for_groom, note_for_bride, recipient_scope, sent_at";

const CARD_MANAGER: FixtureUser = {
  email: "playwright-card-manager@kol-mitzhalot.test",
  firstName: "Fixture",
  lastName: "Manager",
  phone: "+972500000010",
};

const OTHER_SHADCHAN: FixtureUser = {
  email: "playwright-other-shadchan@kol-mitzhalot.test",
  firstName: "Fixture",
  lastName: "Shadchan",
  phone: "+972500000011",
};

/**
 * לקוח service role — עוקף RLS. משמש להקמת מצב ולאימות מצב בלבד, לעולם לא
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

/**
 * הטריגר enforce_signup_identity דוחה יצירת משתמש בלי שם פרטי, שם משפחה,
 * טלפון ואימייל, ולכן כולם נמסרים כבר ביצירה. הוא BEFORE INSERT בלבד, ולכן
 * משתמש שכבר קיים מוחזר כמות שהוא ואינו נבדק שוב.
 */
async function ensureUser(
  admin: SupabaseClient,
  user: FixtureUser,
): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw new Error(`קריאת רשימת המשתמשים נכשלה: ${error.message}`);
  }

  const existing = data.users.find(
    (candidate) => candidate.email === user.email,
  );
  if (existing) return existing.id;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: user.email,
      phone: user.phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        phone_verified: true,
      },
    });

  if (createError || !created.user) {
    throw new Error(
      `יצירת משתמש הבדיקה ${user.email} נכשלה: ${createError?.message ?? "לא הוחזר משתמש"}`,
    );
  }

  return created.user.id;
}

/** מזהה משתמש "מנהל הכרטיסים" - בעלים של כרטיסים שאינם של משתמש הבדיקה */
export async function ensureCardManagerId(
  admin: SupabaseClient,
): Promise<string> {
  return ensureUser(admin, CARD_MANAGER);
}

async function createStudent(
  admin: SupabaseClient,
  params: CreateStudentParams,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: params.userId,
      first_name: params.firstName,
      last_name: params.lastName,
      birth_date: "1998-01-01",
      gender: params.gender,
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
      // identity_number נשאר ריק בכוונה: הוא ייחודי, וערך קבוע היה מתנגש
      // בין הרצות או בין קובצי בדיקה שרצים באותו מסד.
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `יצירת מיועד לבדיקה נכשלה: ${error?.message ?? "לא הוחזרה שורה"}`,
    );
  }

  return data.id as string;
}

/**
 * מקים את כל מה שבדיקות השידוכים זקוקות לו.
 *
 * במכוון אינו נשען על supabase/seed.sql: הזרע רץ רק על המסד המקומי, ובדיקות
 * שנשענו על המזהים שבו נשברו מול מסד בדיקות נקי ב-CI על הפרת מפתח זר.
 */
export async function setupShidduchFixtures(
  admin: SupabaseClient,
): Promise<ShidduchFixtures> {
  const cardManagerId = await ensureUser(admin, CARD_MANAGER);
  const otherShadchanId = await ensureUser(admin, OTHER_SHADCHAN);

  const [groomFirst, groomSecond, brideFirst, brideSecond] = await Promise.all([
    createStudent(admin, {
      userId: cardManagerId,
      gender: "male",
      firstName: "מיועד",
      lastName: "ראשון",
    }),
    createStudent(admin, {
      userId: cardManagerId,
      gender: "male",
      firstName: "מיועד",
      lastName: "שני",
    }),
    createStudent(admin, {
      userId: cardManagerId,
      gender: "female",
      firstName: "מיועדת",
      lastName: "ראשונה",
    }),
    createStudent(admin, {
      userId: cardManagerId,
      gender: "female",
      firstName: "מיועדת",
      lastName: "שנייה",
    }),
  ]);

  return {
    cardManagerId,
    otherShadchanId,
    groomFirst,
    groomSecond,
    brideFirst,
    brideSecond,
  };
}

/**
 * מחיקת המיועדים גוררת מחיקת השידוכים שלהם ב-cascade, ולכן זהו כל הניקוי
 * הדרוש. משתמשי הפיקסצ'ר נשארים ונעשה בהם שימוש חוזר בהרצה הבאה.
 */
export async function teardownShidduchFixtures(
  admin: SupabaseClient,
  fixtures: ShidduchFixtures,
): Promise<void> {
  const { error } = await admin
    .from("students")
    .delete()
    .in("id", [
      fixtures.groomFirst,
      fixtures.groomSecond,
      fixtures.brideFirst,
      fixtures.brideSecond,
    ]);

  if (error) {
    throw new Error(`ניקוי מיועדי הבדיקה נכשל: ${error.message}`);
  }
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

/** ניקוי בין בדיקות — הבדיקות מייצרות שורות אמיתיות במסד */
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
