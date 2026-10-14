import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import type { ProposalDisclosure } from "@/features/students/lib/student-proposal-card";

/**
 * רמת הגישה של המשתמש המחובר לכרטיס מיועד, כפי שהיא נקבעת במסד
 * (`public.get_student_card_access`).
 *
 * הבדיקה חייבת לקרות *לפני* שליפת הכרטיס, כי היא זו שקובעת אילו עמודות
 * מותר בכלל לשלוף - ולא רק מה יוצג. ראו student-proposal-card.ts.
 *
 * כשל בבדיקה נחשב "אין גישה": עדיף כרטיס שלא נטען מאשר כרטיס שנחשף בגלל
 * שגיאה. ה-RLS הוא שכבת ההגנה השנייה בכל מקרה.
 */

export type StudentCardAccessLevel = "none" | "proposal" | "full";

export type StudentCardAccess = ProposalDisclosure & {
  level: StudentCardAccessLevel;
};

const NO_ACCESS: StudentCardAccess = {
  level: "none",
  shareCv: false,
  shareReferences: false,
  shareMedical: false,
};

/** שורה מ-public.get_student_card_access - מאומתת כי זה מידע חיצוני */
const accessRowSchema = z.object({
  access_level: z.enum(["none", "proposal", "full"]),
  share_medical: z.boolean(),
});

/** שורה מ-public.get_proposal_card_disclosure */
const cardDisclosureRowSchema = z.object({
  share_cv: z.boolean(),
  share_references: z.boolean(),
});

type SharedItems = { shareCv: boolean; shareReferences: boolean };
const NOTHING_SHARED: SharedItems = { shareCv: false, shareReferences: false };

/**
 * האם השדכן שיתף את קובץ הקו״ח עם מי שצופה בכרטיס דרך הצעה. כשל בקריאה (או
 * מסד שעוד לא מכיר את הפונקציה) נחשב "לא שותף": הכרטיס נטען בלי הקו״ח.
 */
async function loadSharedItems(
  supabase: SupabaseClient,
  studentId: string,
): Promise<SharedItems> {
  const { data, error } = await supabase.rpc("get_proposal_card_disclosure", {
    p_student_id: studentId,
  });
  if (error) {
    console.error(
      "[students/access] get_proposal_card_disclosure failed",
      studentId,
      describeSupabaseError(error),
    );
    return NOTHING_SHARED;
  }
  const parsed = z.array(cardDisclosureRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[students/access] unexpected get_proposal_card_disclosure shape",
      parsed.error.issues,
    );
    return NOTHING_SHARED;
  }
  const row = parsed.data[0];
  return row
    ? { shareCv: row.share_cv, shareReferences: row.share_references }
    : NOTHING_SHARED;
}

export async function getStudentCardAccess(
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentCardAccess> {
  const { data, error } = await supabase.rpc("get_student_card_access", {
    sid: studentId,
  });

  if (error) {
    console.error(
      "[students/access] get_student_card_access failed",
      studentId,
      describeSupabaseError(error),
    );
    return NO_ACCESS;
  }

  const parsed = z.array(accessRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[students/access] unexpected get_student_card_access shape",
      parsed.error.issues,
    );
    return NO_ACCESS;
  }

  const row = parsed.data[0];
  if (!row) return NO_ACCESS;

  return {
    level: row.access_level,
    // פרטי התקשרות אינם נפתחים עוד לצד השני (share_contact אינו נקרא). מה
    // שנשאר לבחירת השדכן: הקו״ח ופרטי הממליצים (נקראים רק למי שצופה דרך הצעה)
    // וההצהרה הרפואית.
    ...(row.access_level === "proposal"
      ? await loadSharedItems(supabase, studentId)
      : NOTHING_SHARED),
    shareMedical: row.share_medical,
  };
}
