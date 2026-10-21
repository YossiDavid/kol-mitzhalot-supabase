import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

/**
 * מצב השדכן של המשתמש, בצד השרת:
 *   active - תפקיד שדכן ולא מוקפא
 *   frozen - תפקיד שדכן, אבל המנהל הקפיא אותו (shadchanim_info.frozen_at)
 *   none   - אין תפקיד שדכן
 *
 * שדכן מוקפא אינו נחשב שדכן גם במסד (is_shadchan / is_approved_shadchan,
 * 20261101210000_shadchan_freeze.sql). כאן אותו כלל לבדיקות בצד האפליקציה:
 * עמודים ו-API של שדכנים קוראים ל-isActiveShadchan במקום hasRole(user, "shadchan").
 */
export type ShadchanAccess = "active" | "frozen" | "none";

/**
 * האם השורה של המשתמש מוקפאת. RLS: המשתמש קורא את השורה של עצמו (ומנהל -
 * כל שורה). ממוזכר לכל בקשה. כשל בקריאה נחשב כמוקפא (סגירה בטוחה) ונרשם בלוג.
 */
const isShadchanFrozen = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shadchanim_info")
    .select("frozen_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[shadchan-access] reading frozen_at failed:", error);
    return true;
  }
  return Boolean(data?.frozen_at);
});

type UserWithId = Pick<User, "id" | "app_metadata">;

export async function getShadchanAccess(
  user: UserWithId | null | undefined,
): Promise<ShadchanAccess> {
  if (!user || !hasRole(user, "shadchan")) return "none";
  return (await isShadchanFrozen(user.id)) ? "frozen" : "active";
}

/** שדכן עם כוחות שדכן (לא מוקפא) */
export async function isActiveShadchan(
  user: UserWithId | null | undefined,
): Promise<boolean> {
  return (await getShadchanAccess(user)) === "active";
}

/** הודעת ה-API לשדכן מוקפא (403) */
export const SHADCHAN_FROZEN_API_ERROR = "חשבון השדכן שלך מוקפא על ידי ההנהלה";
