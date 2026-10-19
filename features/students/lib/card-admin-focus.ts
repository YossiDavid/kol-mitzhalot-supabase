import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { STUDENT_CARDS_VIEW } from "@/features/students/lib/third-party-card";

/**
 * סימון "במיקוד" של הנהלת המערכת (student_admin_focus). כותב רק מנהל, דרך
 * PATCH /api/v1/students/:id/admin-focus; קוראים שדכנים ומנהלים, דרך
 * student_cards (לבעל הכרטיס ולאיש צוות העמודות חוזרות ריקות).
 */
export const ADMIN_FOCUS_LABEL = "במיקוד";

/** אורך מרבי להערת המיקוד (CHECK במסד) */
export const ADMIN_FOCUS_NOTE_MAX_LENGTH = 200;

export function adminFocusEndpoint(studentId: string): string {
  return `/api/v1/students/${studentId}/admin-focus`;
}

/** גוף הבקשה לנתיב המנהל */
export const adminFocusBodySchema = z.object({
  focused: z.boolean(),
  note: z
    .string()
    .trim()
    .max(ADMIN_FOCUS_NOTE_MAX_LENGTH)
    .nullish()
    .transform((note) => note || null),
});

export type CardAdminFocus = {
  focusedAt: string | null;
  note: string | null;
};

const focusRowSchema = z.object({
  admin_focus_at: z.string().nullable(),
  admin_focus_note: z.string().nullable(),
});

/**
 * מצב המיקוד של כרטיס לצופה הנוכחי. null כשהשליפה נכשלה (בלי תג ובלי בקרה);
 * לצופה שאינו שדכן או מנהל - תמיד "לא במיקוד".
 */
export async function loadCardAdminFocus(
  supabase: SupabaseClient,
  studentId: string,
): Promise<CardAdminFocus | null> {
  const { data, error } = await supabase
    .from(STUDENT_CARDS_VIEW)
    .select("admin_focus_at, admin_focus_note")
    .eq("id", studentId)
    .maybeSingle();
  if (error) {
    console.error(
      "[students/card] admin focus lookup failed",
      describeSupabaseError(error),
    );
    return null;
  }
  const parsed = focusRowSchema.safeParse(data);
  if (!parsed.success) return { focusedAt: null, note: null };
  return {
    focusedAt: parsed.data.admin_focus_at,
    note: parsed.data.admin_focus_note,
  };
}
