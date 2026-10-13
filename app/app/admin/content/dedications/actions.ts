"use server";

/**
 * Callers: מסך הניהול של ההקדשות (טופס, פרסום, מחיקה).
 * הכתיבה כאן, בשרת: בדיקת מנהל, אימות zod וכתיבה בסשן של המשתמש (RLS חל גם
 * הוא), ואחריה הפקעת תג הקאש כדי שהשינוי יופיע באתר מיד. הודעות השגיאה
 * קבועות; פרטי השגיאה נרשמים ללוג בשרת בלבד.
 */

import { updateTag } from "next/cache";

import { DEDICATIONS_CACHE_TAG } from "@/features/dedications/lib/dedications-cache";
import {
  dedicationIdSchema,
  saveDedicationInputSchema,
  toDedicationRow,
} from "@/features/dedications/lib/dedication-schema";
import { createClient } from "@/lib/supabase/server";
import { getUser, hasRole } from "@/lib/user";

export type DedicationActionResult =
  | { ok: true }
  | { ok: false; message: string };

const MESSAGES = {
  forbidden: "אין הרשאה לבצע את הפעולה",
  invalid: "הנתונים שהוזנו אינם תקינים",
  saveFailed: "השמירה נכשלה. נסו שוב",
  updateFailed: "העדכון נכשל. נסו שוב",
  deleteFailed: "המחיקה נכשלה. נסו שוב",
} as const;

const FAILURE = (message: string): DedicationActionResult => ({
  ok: false,
  message,
});

async function isAdminUser(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user && hasRole(user, "admin"));
}

/** יצירה (בלי id) או עדכון (עם id) של הקדשה */
export async function saveDedication(
  input: unknown,
): Promise<DedicationActionResult> {
  if (!(await isAdminUser())) return FAILURE(MESSAGES.forbidden);

  const parsed = saveDedicationInputSchema.safeParse(input);
  if (!parsed.success) return FAILURE(MESSAGES.invalid);

  const { id, values } = parsed.data;
  const row = toDedicationRow(values);
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("dedications").update(row).eq("id", id)
    : await supabase.from("dedications").insert(row);

  if (error) {
    console.error("[dedications] שמירה נכשלה", error);
    return FAILURE(MESSAGES.saveFailed);
  }

  updateTag(DEDICATIONS_CACHE_TAG);
  return { ok: true };
}

/** פרסום או הסרה מפרסום */
export async function setDedicationPublished(
  id: unknown,
  isPublished: boolean,
): Promise<DedicationActionResult> {
  if (!(await isAdminUser())) return FAILURE(MESSAGES.forbidden);

  const parsedId = dedicationIdSchema.safeParse(id);
  if (!parsedId.success) return FAILURE(MESSAGES.invalid);

  const { error } = await (
    await createClient()
  )
    .from("dedications")
    .update({ is_published: Boolean(isPublished) })
    .eq("id", parsedId.data);

  if (error) {
    console.error("[dedications] שינוי פרסום נכשל", error);
    return FAILURE(MESSAGES.updateFailed);
  }

  updateTag(DEDICATIONS_CACHE_TAG);
  return { ok: true };
}

export async function deleteDedication(
  id: unknown,
): Promise<DedicationActionResult> {
  if (!(await isAdminUser())) return FAILURE(MESSAGES.forbidden);

  const parsedId = dedicationIdSchema.safeParse(id);
  if (!parsedId.success) return FAILURE(MESSAGES.invalid);

  const { error } = await (await createClient())
    .from("dedications")
    .delete()
    .eq("id", parsedId.data);

  if (error) {
    console.error("[dedications] מחיקה נכשלה", error);
    return FAILURE(MESSAGES.deleteFailed);
  }

  updateTag(DEDICATIONS_CACHE_TAG);
  return { ok: true };
}
