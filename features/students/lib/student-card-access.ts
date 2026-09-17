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
  shareContact: false,
  shareMedical: false,
};

/** שורה מ-public.get_student_card_access - מאומתת כי זה מידע חיצוני */
const accessRowSchema = z.object({
  access_level: z.enum(["none", "proposal", "full"]),
  share_contact: z.boolean(),
  share_medical: z.boolean(),
});

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
    shareContact: row.share_contact,
    shareMedical: row.share_medical,
  };
}
