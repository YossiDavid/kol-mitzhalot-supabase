import { type EmailOtpType } from "@supabase/supabase-js";
import { z } from "zod";

/** סוגי האסימון שמייל של Supabase יכול לשאת */
const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[];

/** כש-{{ .TokenType }} ריק בתבנית — קישור כניסה רגיל */
export const DEFAULT_EMAIL_OTP_TYPE = "magiclink" satisfies EmailOtpType;

const MAX_TOKEN_LENGTH = 512;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;
const MAX_EMAIL_LENGTH = 254;

/** שדה מ-FormData: ריק או חסר נחשבים כאילו לא נשלח */
const optionalField = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => value || undefined)
    .optional();

/** הפרמטרים שנושא כפתור האישור: אסימון מהקישור במייל, או `code` של PKCE */
export const confirmLinkSchema = z.object({
  token_hash: optionalField(MAX_TOKEN_LENGTH),
  type: optionalField(32)
    .transform((value) => value ?? DEFAULT_EMAIL_OTP_TYPE)
    .pipe(z.enum(EMAIL_OTP_TYPES)),
  code: optionalField(MAX_TOKEN_LENGTH),
  next: optionalField(1024),
});

/** מסיר רווחים ומפרידים: "123 456" ו-"123-456" הם אותו קוד */
export function normalizeEmailCode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** הקוד שהוקלד ידנית: מספרים בלבד, 6 עד 10 ספרות (אורך הקוד נקבע בספק) */
export const emailCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(MAX_EMAIL_LENGTH),
  code: z
    .string()
    .transform(normalizeEmailCode)
    .pipe(
      z
        .string()
        .regex(new RegExp(`^\\d{${MIN_CODE_LENGTH},${MAX_CODE_LENGTH}}$`)),
    ),
  next: z.string().max(1024).nullish(),
});

export type EmailCodeInput = z.input<typeof emailCodeSchema>;
