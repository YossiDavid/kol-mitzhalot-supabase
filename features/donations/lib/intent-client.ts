/**
 * קריאת הדפדפן ליצירת כוונת תרומה ולבדיקת הסטטוס שלה. אין כאן סודות: השרת הוא
 * שמנפיק את ה-id וכתובת ה-CallBack, והלקוח רק משתמש בהם.
 */
import { z } from "zod";
import type { DonationStatus } from "./status";
import { isDonationStatus } from "./status";

export const INTENT_ENDPOINT = "/api/v1/donations/intent";
export const donationStatusEndpoint = (id: string) =>
  `/api/v1/donations/${id}/status`;

export const INTENT_FAILED_MESSAGE =
  "לא הצלחנו להתחיל את התרומה. בדקו את החיבור ונסו שוב.";

const intentResponseSchema = z.object({
  id: z.uuid(),
  callbackUrl: z.string().nullable(),
});

export type DonationIntent = z.infer<typeof intentResponseSchema>;

export interface IntentRequest {
  amount: number;
  frequency: "once" | "monthly";
  dedicationType: string;
  dedicationName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export type IntentResult =
  | { ok: true; intent: DonationIntent }
  | { ok: false; message: string };

const errorBodySchema = z.object({ error: z.string() });

export async function createDonationIntent(
  request: IntentRequest,
): Promise<IntentResult> {
  try {
    const response = await fetch(INTENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const parsed = intentResponseSchema.safeParse(body);
      if (parsed.success) return { ok: true, intent: parsed.data };
    } else if (response.status === 400 || response.status === 429) {
      // שגיאות שהשרת כתב לתורם בעברית
      const parsedError = errorBodySchema.safeParse(body);
      if (parsedError.success) {
        return { ok: false, message: parsedError.data.error };
      }
    }
  } catch {
    // כשל רשת: ההודעה הכללית מטה
  }
  return { ok: false, message: INTENT_FAILED_MESSAGE };
}

const statusResponseSchema = z.object({ status: z.string() });

/** null בכל כשל: הקורא פשוט מנסה שוב או מוותר, בלי להפחיד את התורם */
export async function fetchDonationStatus(
  id: string,
): Promise<DonationStatus | null> {
  try {
    const response = await fetch(donationStatusEndpoint(id), {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const parsed = statusResponseSchema.safeParse(await response.json());
    return parsed.success && isDonationStatus(parsed.data.status)
      ? parsed.data.status
      : null;
  } catch {
    return null;
  }
}
