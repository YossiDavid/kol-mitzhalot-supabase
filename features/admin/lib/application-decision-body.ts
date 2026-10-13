import { z } from "zod";

/** אורך מקסימלי לסיבת דחייה (נשמרת ב-DB ונשלחת במייל למבקש) */
export const APPLICATION_REJECT_REASON_MAX_LENGTH = 1000;

/** אורך מקסימלי להודעה חופשית של מנהל למבקש (גם מצורפת לאישור) */
export const APPLICATION_MESSAGE_MAX_LENGTH = 2000;

/** הודעה שנשארה ריקה אחרי trim נחשבת כלא הוזנה */
const optionalMessageSchema = z
  .string()
  .trim()
  .max(APPLICATION_MESSAGE_MAX_LENGTH)
  .transform((value) => value || undefined)
  .optional();

export const approveBodySchema = z.object({
  userId: z.guid(),
  /** הודעה אופציונלית שנשלחת למבקש יחד עם האישור */
  message: optionalMessageSchema,
});

export const messageBodySchema = z.object({
  userId: z.guid(),
  message: z.string().trim().min(1).max(APPLICATION_MESSAGE_MAX_LENGTH),
});

export const rejectBodySchema = z.object({
  userId: z.guid(),
  reason: z
    .string()
    .trim()
    .max(APPLICATION_REJECT_REASON_MAX_LENGTH)
    .optional(),
});

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** גוף JSON פגום או שאינו תואם לסכמה מחזיר שגיאה (400), לא חריגה (500) */
export async function parseDecisionBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "Invalid body" };
  }
  return { ok: true, data: parsed.data };
}
