import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { describeZodIssues } from "@/lib/describe-zod-issues";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ANONYMOUS_BASIC_STUDENT_SELECT,
  ANONYMOUS_STUDENT_SELECT,
  BASIC_STUDENT_SELECT,
  FULL_STUDENT_SELECT,
  studentRowSchemas,
  type AnonymousBasicStudentRow,
  type AnonymousStudentRow,
  type BasicStudentRow,
  type FullStudentRow,
} from "@/features/students/lib/student-card-data";
import { STUDENT_CARDS_VIEW } from "@/features/students/lib/third-party-card";
import {
  parseProposalRow,
  type ProposalDisclosure,
  type ProposalStudentRow,
} from "@/features/students/lib/student-proposal-card";

/**
 * הכרטיס שנשלף, מתויג לפי הווריאנט. כל ענף נושא את השורה בטיפוס של ה-select
 * שנשלח בפועל, ולכן אי אפשר לקרוא בטעות עמודה שהווריאנט לא שולף.
 */
export type LoadedStudentCard =
  | { variant: "anonymous"; row: AnonymousStudentRow }
  | { variant: "anonymous-basic"; row: AnonymousBasicStudentRow }
  | { variant: "basic"; row: BasicStudentRow }
  | { variant: "proposal"; row: ProposalStudentRow }
  | { variant: "full"; row: FullStudentRow };

export type LoadStudentCardResult =
  | { status: "ok"; card: LoadedStudentCard }
  | { status: "missing" }
  /** `detail` לרישום בשרת בלבד - לא מוצג לגולש */
  | { status: "error"; detail: unknown };

export type LoadStudentCardInput = {
  /** ה-client של המשתמש המחובר (לא בשימוש לגולש אנונימי) */
  supabase: SupabaseClient;
  studentId: string;
  isAnonymous: boolean;
  /** כרטיס צד שלישי שלא אושר - נשלפים נתונים בסיסיים בלבד */
  isBasicOnly: boolean;
  /** פתיחת ההצעה, כשהצופה מגיע לכרטיס דרך הצעת שידוך; אחרת null */
  proposal: ProposalDisclosure | null;
};

/** הפונקציה שמחזירה את הכרטיס למי שצופה בו דרך הצעת שידוך */
const PROPOSAL_CARD_RPC = "get_proposal_student_card";

/**
 * ההצהרה הרפואית לפי רמת החשיפה שבחר בעל הכרטיס. את medical_records עצמה
 * קוראים רק בעל הכרטיס ומנהל; שדכן מקבל ממנה את מה שרמת החשיפה מתירה
 * (20261027110000_medical_exposure_and_card_fields_rpcs.sql).
 */
export const STUDENT_MEDICAL_RECORD_RPC = "get_student_medical_record";

/** השאילתה עצמה לפי הווריאנט; הנתונים חוזרים כ-unknown ומאומתים אחר כך */
async function fetchRow(input: LoadStudentCardInput) {
  const { supabase, studentId, isAnonymous, isBasicOnly, proposal } = input;
  if (isAnonymous) {
    // אין RLS ל-client הזה (service role) - הסינון על deleted_at חייב לקרות
    // כאן במפורש, אחרת כרטיס שנמחק "רך" יחשף.
    return createAdminClient()
      .from("students")
      .select(
        isBasicOnly ? ANONYMOUS_BASIC_STUDENT_SELECT : ANONYMOUS_STUDENT_SELECT,
      )
      .eq("id", studentId)
      .is("deleted_at", null)
      .single();
  }
  if (proposal) {
    // מי שקיבל הצעה אינו קורא את students בכלל: המסד בונה לו את הכרטיס מרשימת
    // עמודות מפורשת, לפי מה שהשדכן פתח להצעה (וגם בכרטיס צד שלישי שלא אושר -
    // שם הפונקציה מחזירה נתונים בסיסיים בלבד). null: אין הצעה שחושפת את הכרטיס.
    return supabase.rpc(PROPOSAL_CARD_RPC, { p_student_id: studentId });
  }
  if (isBasicOnly) {
    // כרטיס צד שלישי שלא אושר: שורת students שלו אינה נקראת ישירות על ידי
    // שדכן או איש צוות. ה-view מחזיר את הנתונים הבסיסיים בלבד, ו-parents_info
    // שלו כבר מכיל שמות הורים בלבד.
    return supabase
      .from(STUDENT_CARDS_VIEW)
      .select(BASIC_STUDENT_SELECT)
      .eq("id", studentId)
      .single();
  }
  return supabase
    .from("students")
    .select(FULL_STUDENT_SELECT)
    .eq("id", studentId)
    .single();
}

/**
 * כלל ההגבלה בשלוש רמות: ה-select (מה נשלף), ה-schema (מה עובר את הגבול
 * הזה - עמודה שלא הוצהרה נחתכת) והטיפוס (מה הקוד שאחרי יכול לקרוא).
 */
function wrap<T>(
  result: z.ZodSafeParseResult<T>,
  toCard: (row: T) => LoadedStudentCard,
): LoadStudentCardResult {
  if (!result.success)
    return { status: "error", detail: describeZodIssues(result.error.issues) };
  return { status: "ok", card: toCard(result.data) };
}

function parseCard(
  data: unknown,
  { isAnonymous, isBasicOnly, proposal }: LoadStudentCardInput,
): LoadStudentCardResult {
  if (isAnonymous) {
    return isBasicOnly
      ? wrap(studentRowSchemas.anonymousBasic.safeParse(data), (row) => ({
          variant: "anonymous-basic",
          row,
        }))
      : wrap(studentRowSchemas.anonymous.safeParse(data), (row) => ({
          variant: "anonymous",
          row,
        }));
  }
  // לפני הבסיסי, כמו ב-fetchRow: צופה דרך הצעה מקבל תמיד את שורת ההצעה
  if (proposal) {
    return wrap(parseProposalRow(data, proposal), (row) => ({
      variant: "proposal",
      row,
    }));
  }
  if (isBasicOnly) {
    return wrap(studentRowSchemas.basic.safeParse(data), (row) => ({
      variant: "basic",
      row,
    }));
  }
  return wrap(studentRowSchemas.full.safeParse(data), (row) => ({
    variant: "full",
    row,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * בכרטיס המלא (וגם במסך העריכה): כשה-embed של medical_records חזר ריק (הצופה אינו בעל הכרטיס
 * ואינו מנהל, וה-RLS חסם), ההצהרה נשלפת מהפונקציה - מוסתרת לפי רמת החשיפה.
 * העתק חדש של השורה, לא שינוי במקום.
 */
export async function withViewerMedical(
  supabase: SupabaseClient,
  studentId: string,
  data: unknown,
): Promise<{ data: unknown; error: unknown }> {
  if (!isRecord(data) || data.medical_records) return { data, error: null };
  const { data: medical, error } = await supabase.rpc(
    STUDENT_MEDICAL_RECORD_RPC,
    { p_student_id: studentId },
  );
  if (error) return { data, error: describeSupabaseError(error) };
  return { data: { ...data, medical_records: medical ?? null }, error: null };
}

/**
 * שולף כרטיס ומאמת אותו. הנתונים מה-DB נכנסים כ-unknown (ל-supabase-js אין
 * טיפוסים שנוצרו, והוא אינו יכול להסיק שורה ממחרוזת select שנבנית בזמן ריצה)
 * ויוצאים רק דרך ה-schema של הווריאנט.
 */
export async function loadStudentCard(
  input: LoadStudentCardInput,
): Promise<LoadStudentCardResult> {
  const { data, error } = await fetchRow(input);
  if (error) return { status: "error", detail: describeSupabaseError(error) };
  if (!data) return { status: "missing" };
  const isFull = !input.isAnonymous && !input.proposal && !input.isBasicOnly;
  if (!isFull) return parseCard(data, input);
  const medical = await withViewerMedical(
    input.supabase,
    input.studentId,
    data,
  );
  if (medical.error) return { status: "error", detail: medical.error };
  return parseCard(medical.data, input);
}
