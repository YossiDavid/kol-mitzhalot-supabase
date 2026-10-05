import { z } from "zod";

import type { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import type { ClosedNoticeRecord } from "@/features/shidduchim/lib/closed-notice";
import { SHIDDUCH_SIDES } from "@/features/shidduchim/lib/responses";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const noticeRowSchema = z.object({
  id: z.string(),
  side: z.enum(SHIDDUCH_SIDES),
  message: z.string(),
  created_at: z.string(),
  email_sent_at: z.string().nullable(),
});

/**
 * ההודעות ש"עדכון הצד השני" שלח לשידוך. ה-RLS מחזיר רק לשדכן ההצעה
 * ולמנהל. שגיאה מחזירה רשימה ריקה (ונרשמת): התצוגה משנית ואינה חוסמת
 * את כרטיס השידוך.
 */
export async function getClosedNotices(
  supabase: ServerSupabase,
  shidduchId: string,
): Promise<ClosedNoticeRecord[]> {
  const { data, error } = await supabase
    .from("shidduch_closed_notices")
    .select("id, side, message, created_at, email_sent_at")
    .eq("shidduch_id", shidduchId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[closed-notices] select failed",
      describeSupabaseError(error),
    );
    return [];
  }

  const parsed = z.array(noticeRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[closed-notices] unexpected shape", parsed.error.issues);
    return [];
  }

  return parsed.data.map((row) => ({
    id: row.id,
    side: row.side,
    message: row.message,
    createdAt: row.created_at,
    emailSent: row.email_sent_at !== null,
  }));
}
