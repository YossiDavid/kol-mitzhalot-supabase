import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * "מדוע מילאתי" שמור ב-student_private ולא ב-author_info, כדי ששדכן לא יקרא
 * אותו ישירות מהמסד (20261108160000_card_private_fields.sql). RLS מחזירה
 * אותו רק לבעל הכרטיס ולמנהל; לכל צופה אחר חוזר null.
 */
export async function loadFillReason(
  supabase: SupabaseClient,
  studentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("student_private")
    .select("fill_reason")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) {
    console.error(
      "[students/private] fill reason lookup failed",
      describeSupabaseError(error),
    );
    return null;
  }
  return typeof data?.fill_reason === "string" ? data.fill_reason : null;
}

/** author_info עם ההסבר, לתצוגה ולטופס של בעל הכרטיס או מנהל */
export function withFillReason<T>(authorInfo: T, fillReason: string | null): T {
  if (!fillReason) return authorInfo;
  if (typeof authorInfo !== "object" || authorInfo === null) return authorInfo;
  if (Array.isArray(authorInfo)) return authorInfo;
  return { ...authorInfo, fillReason };
}
