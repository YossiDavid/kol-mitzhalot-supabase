import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApplicationKind } from "@/lib/email/templates/application-decision";

export type ApplicationMessage = {
  id: string;
  applicant_user_id: string;
  body: string;
  created_at: string;
};

const MESSAGE_COLUMNS = "id, applicant_user_id, body, created_at";

/**
 * הודעות מנהל לבקשות מסוג מסוים, מהחדש לישן. נקרא עם לקוח של משתמש מחובר:
 * RLS מחזיר למנהל הכול ולמבקש רק את שלו. שגיאה נרשמת והתוצאה ריקה.
 */
export async function fetchApplicationMessages(
  supabase: SupabaseClient,
  kind: ApplicationKind,
  applicantUserId?: string,
): Promise<ApplicationMessage[]> {
  let query = supabase
    .from("application_messages")
    .select(MESSAGE_COLUMNS)
    .eq("request_kind", kind)
    .order("created_at", { ascending: false });
  if (applicantUserId) {
    query = query.eq("applicant_user_id", applicantUserId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching application messages:", error);
    return [];
  }
  return (data ?? []) as ApplicationMessage[];
}

/** קיבוץ לפי מבקש, בלי לשנות את הקלט */
export function groupMessagesByApplicant(
  messages: readonly ApplicationMessage[],
): ReadonlyMap<string, readonly ApplicationMessage[]> {
  const grouped = new Map<string, ApplicationMessage[]>();
  for (const message of messages) {
    grouped.set(message.applicant_user_id, [
      ...(grouped.get(message.applicant_user_id) ?? []),
      message,
    ]);
  }
  return grouped;
}
