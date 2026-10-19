import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";

import {
  needsTermsAcceptance,
  readSignupTermsVersion,
  TERMS_CONTENT_KEY,
} from "./terms";

/**
 * חסימת אישור התקנון במעטפת /app. בקשה רגילה עולה שאילתה אחת קטנה
 * (get_terms_gate_status); את תוכן התקנון שולפים רק כשבאמת צריך להציג אותו.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type TermsGate = {
  version: number;
  title: string;
  /** HTML מעורך התוכן של המנהל - אותו תוכן כמו בדף /legal */
  content: string;
};

const gateStatusSchema = z.object({
  required_version: z.number().int(),
  accepted_version: z.number().int(),
});

type GateStatus = { requiredVersion: number; acceptedVersion: number };

/** בכשל: לא חוסמים. חסימה בגלל תקלה הייתה נועלת את כולם מחוץ למערכת */
const OPEN_GATE: GateStatus = { requiredVersion: 0, acceptedVersion: 0 };

/** ממוזכר לבקשה: המעטפת והדף יכולים לקרוא אותו באותה בקשה */
export const getTermsGateStatus = cache(async (): Promise<GateStatus> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_terms_gate_status");
    if (error) {
      console.error("[terms/gate] status", describeSupabaseError(error));
      return OPEN_GATE;
    }
    const parsed = z.array(gateStatusSchema).safeParse(data ?? []);
    const row = parsed.success ? parsed.data[0] : undefined;
    if (!row) return OPEN_GATE;
    return {
      requiredVersion: row.required_version,
      acceptedVersion: row.accepted_version,
    };
  } catch (error) {
    console.error("[terms/gate] status", error);
    return OPEN_GATE;
  }
});

/** רישום אישור לגרסה. כפילות (כבר אושרה) נחשבת הצלחה */
export async function recordTermsAcceptance(
  supabase: ServerSupabase,
  userId: string,
  version: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("terms_acceptances")
    .upsert(
      { user_id: userId, version },
      { onConflict: "user_id,version", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[terms/gate] accept", describeSupabaseError(error));
    return false;
  }
  return true;
}

async function loadTermsContent(
  supabase: ServerSupabase,
): Promise<{ title: string; content: string }> {
  const { data, error } = await supabase
    .from("system_content")
    .select("title, content")
    .eq("key", TERMS_CONTENT_KEY)
    .maybeSingle();
  if (error) {
    console.error("[terms/gate] content", describeSupabaseError(error));
  }
  return { title: data?.title || "תקנון", content: data?.content ?? "" };
}

/**
 * null - אין מה לחסום. אחרת: הגרסה והתוכן להצגה בדיאלוג. מי שסימן את
 * התקנון בטופס ההרשמה, והגרסה ההיא עדיין הנוכחית, נרשם כאן כמאשר ולא נחסם.
 */
export async function resolveTermsGate(user: User): Promise<TermsGate | null> {
  const status = await getTermsGateStatus();
  if (!needsTermsAcceptance(status)) return null;

  const supabase = await createClient();
  const version = status.requiredVersion;

  if (readSignupTermsVersion(user) === version) {
    const isRecorded = await recordTermsAcceptance(supabase, user.id, version);
    if (isRecorded) return null;
  }

  return { version, ...(await loadTermsContent(supabase)) };
}
