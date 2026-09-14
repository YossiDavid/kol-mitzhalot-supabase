import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * שליפת "הערות שדכן" ו"פידבק אנשי צוות" לכרטיס מיועד. לקוד שרת בלבד, עם
 * client של המשתמש המחובר (או האנונימי), כדי ש-auth.uid() וה-RLS יחולו.
 * ראה supabase/migrations/20260915120000_student_notes_private_and_staff_feedback.sql
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const FALLBACK_AUTHOR_NAME = "איש צוות";

const privateNoteRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
});

const staffFeedbackRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
  author_name: z.string().nullable(),
  institution_name: z.string().nullable(),
  institution_city: z.string().nullable(),
});

/** הערה פרטית של השדכן המחובר - המחבר הוא תמיד הצופה עצמו */
export type PrivateNote = z.infer<typeof privateNoteRowSchema>;

export type StaffFeedback = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  institutionName: string | null;
  institutionCity: string | null;
};

/**
 * ההערות שהמשתמש המחובר כתב כשדכן/מנהל. ה-RLS ממילא מחזיר רק הערות של
 * הכותב; הסינון כאן מוציא פידבק שאותו משתמש כתב כאיש צוות, שמוצג בנפרד.
 * בשגיאה מוחזרת רשימה ריקה (אחרי רישום), כדי לא להפיל את עמוד הכרטיס.
 */
export async function loadMyShadchanNotes(
  supabase: ServerSupabase,
  studentId: string,
  userId: string,
): Promise<PrivateNote[]> {
  const { data, error } = await supabase
    .from("student_notes")
    .select("id, body, created_at")
    .eq("student_id", studentId)
    .eq("author_id", userId)
    .neq("author_role", "staff")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[students/notes] private notes",
      describeSupabaseError(error),
    );
    return [];
  }

  const parsed = z.array(privateNoteRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[students/notes] unexpected notes shape",
      parsed.error.issues,
    );
    return [];
  }
  return parsed.data;
}

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
