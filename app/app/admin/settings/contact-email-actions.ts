"use server";

/**
 * Callers: features/contact-email/components/contact-email-form.tsx.
 * שמירת "אימייל ליצירת קשר" (system_settings.text_value): בדיקת מנהל, אימות zod,
 * כתיבה עם service role (למשתמשים אין מדיניות כתיבה על הטבלה), והפקעת תג הקאש
 * כדי שהתחתית תתעדכן מיד. ריק = מחיקת השורה. הודעות קבועות; הפרטים בלוג בלבד.
 */

import { updateTag } from "next/cache";

import {
  CONTACT_EMAIL_CACHE_TAG,
  CONTACT_EMAIL_MESSAGES,
  CONTACT_EMAIL_SETTING_KEY,
  contactEmailSchema,
} from "@/features/contact-email/lib/contact-email-model";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, hasRole } from "@/lib/user";

export type ContactEmailActionResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

export async function saveContactEmail(
  input: unknown,
): Promise<ContactEmailActionResult> {
  const user = await getUser();
  if (!hasRole(user, "admin")) {
    return { ok: false, message: CONTACT_EMAIL_MESSAGES.forbidden };
  }

  const parsed = contactEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: CONTACT_EMAIL_MESSAGES.invalid };
  }
  const email = parsed.data;

  try {
    const admin = createAdminClient();
    const { error } = email
      ? await admin.from("system_settings").upsert(
          {
            key: CONTACT_EMAIL_SETTING_KEY,
            text_value: email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        )
      : await admin
          .from("system_settings")
          .delete()
          .eq("key", CONTACT_EMAIL_SETTING_KEY);

    if (error) throw error;
  } catch (error) {
    console.error("[contact-email] שמירת האימייל נכשלה", error);
    return { ok: false, message: CONTACT_EMAIL_MESSAGES.saveFailed };
  }

  updateTag(CONTACT_EMAIL_CACHE_TAG);
  return { ok: true, email };
}
