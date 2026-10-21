"use server";

import { z } from "zod";

import { recordTermsAcceptance } from "@/features/auth/lib/terms-gate";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/user";

/**
 * Callers: features/auth/components/terms-gate-dialog.tsx.
 * אישור התקנון בדיאלוג החוסם. הגרסה מגיעה מהדיאלוג - הגבוהה ביותר שמיועדת
 * למשתמש (לא בהכרח הנוכחית, כשהנוכחית פורסמה לקבוצה אחרת). ה-RLS מתיר רק
 * גרסה שכבר פורסמה; אם המנהל פרסם בינתיים גרסה חדשה שמיועדת למשתמש,
 * הרענון שאחרי האישור מציג אותה לאישור.
 */

export type AcceptTermsResult = { ok: true } | { ok: false; message: string };

const versionSchema = z.number().int().min(1);

const MESSAGES = {
  unauthenticated: "יש להתחבר מחדש",
  invalid: "גרסת התקנון אינה תקינה",
  failed: "שמירת האישור נכשלה. ייתכן שהתקנון עודכן - רעננו את העמוד ונסו שוב",
} as const;

export async function acceptTerms(
  version: unknown,
): Promise<AcceptTermsResult> {
  const parsed = versionSchema.safeParse(version);
  if (!parsed.success) return { ok: false, message: MESSAGES.invalid };

  const user = await getUser();
  if (!user) return { ok: false, message: MESSAGES.unauthenticated };

  const supabase = await createClient();
  const isRecorded = await recordTermsAcceptance(
    supabase,
    user.id,
    parsed.data,
  );
  return isRecorded ? { ok: true } : { ok: false, message: MESSAGES.failed };
}
