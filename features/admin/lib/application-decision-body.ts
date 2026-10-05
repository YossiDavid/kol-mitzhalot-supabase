import { z } from "zod";

/** אורך מקסימלי לסיבת דחייה (נשמרת ב-DB ונשלחת במייל למבקש) */
export const APPLICATION_REJECT_REASON_MAX_LENGTH = 1000;

export const approveBodySchema = z.object({
  userId: z.guid(),
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
