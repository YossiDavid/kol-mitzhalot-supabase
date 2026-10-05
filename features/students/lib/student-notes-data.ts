import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * שליפת "הערות שדכן" ו"פידבק אנשי צוות" לכרטיס מיועד. לקוד שרת בלבד, עם
 * client של המשתמש המחובר (או האנונימי), כדי ש-auth.uid() וה-RLS יחולו.
 * ראה supabase/migrations/20260915120000_student_notes_private_and_staff_feedback.sql
 * ואת 20261006110000_shared_notes_and_auto_engagement.sql (הערות שדכן משותפות).
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const FALLBACK_AUTHOR_NAME = "איש צוות";
const FALLBACK_SHADCHAN_NAME = "שדכן";

const shadchanNoteRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  author_id: z.string(),
  author_name: z.string().nullable(),
});

const staffFeedbackRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
  author_name: z.string().nullable(),
  institution_name: z.string().nullable(),
  institution_city: z.string().nullable(),
});

/**
 * הערת שדכן: גלויה לכל השדכנים והמנהלים. canManage - האם הצופה רשאי לערוך
 * ולמחוק אותה (הכותב, או מנהל); האכיפה האמיתית ב-RLS ובמסלולי ה-API.
 */
export type ShadchanNote = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  canManage: boolean;
};

/** שם קודם של הטיפוס, מתקופת ההערות הפרטיות - נשאר עד שהצרכנים יעברו */
export type PrivateNote = ShadchanNote;

export type StaffFeedback = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  institutionName: string | null;
  institutionCity: string | null;
};

/** האם המשתמש המחובר מנהל - לקביעת עריכה/מחיקה של הערות של אחרים */
async function isCurrentUserAdmin(supabase: ServerSupabase): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("[students/notes] is_admin", describeSupabaseError(error));
    return false;
  }
  return data === true;
}

/**
 * כל הערות השדכן על הכרטיס, החדשה קודם, עם שם הכותב. הפונקציה בצד המסד
 * מחזירה שורות רק לשדכן/מנהל. בשגיאה מוחזרת רשימה ריקה (אחרי רישום), כדי
 * לא להפיל את עמוד הכרטיס.
 */
export async function loadShadchanNotes(
  supabase: ServerSupabase,
  studentId: string,
  userId: string,
): Promise<ShadchanNote[]> {
  const [{ data, error }, isAdmin] = await Promise.all([
    supabase.rpc("get_student_shadchan_notes", { p_student_id: studentId }),
    isCurrentUserAdmin(supabase),
  ]);

  if (error) {
    console.error(
      "[students/notes] shadchan notes",
      describeSupabaseError(error),
    );
    return [];
  }

  const parsed = z.array(shadchanNoteRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[students/notes] unexpected notes shape",
      parsed.error.issues,
    );
    return [];
  }

  return parsed.data.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.author_id,
    authorName: row.author_name ?? FALLBACK_SHADCHAN_NAME,
    canManage: isAdmin || row.author_id === userId,
  }));
}

/** שם קודם של loadShadchanNotes - נשאר עד שעמוד הכרטיס יעבור לשם החדש */
export const loadMyShadchanNotes = loadShadchanNotes;

/** פידבק אנשי צוות על הכרטיס, החדש קודם. זמין גם לצופה לא מחובר. */
export async function loadStaffFeedback(
  supabase: ServerSupabase,
  studentId: string,
): Promise<StaffFeedback[]> {
  const { data, error } = await supabase.rpc("get_student_staff_feedback", {
    p_student_id: studentId,
  });

  if (error) {
    console.error(
      "[students/notes] staff feedback",
      describeSupabaseError(error),
    );
    return [];
  }

  const parsed = z.array(staffFeedbackRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[students/notes] unexpected staff feedback shape",
      parsed.error.issues,
    );
    return [];
  }

  return parsed.data.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorName: row.author_name ?? FALLBACK_AUTHOR_NAME,
    institutionName: row.institution_name,
    institutionCity: row.institution_city,
  }));
}
