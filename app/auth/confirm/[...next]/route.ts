import { unstable_noStore as noStore } from "next/cache";
import { type NextRequest } from "next/server";

import { confirmMagicLink } from "@/features/auth/lib/confirm-magic-link";

/**
 * אותו אימות כמו /auth/confirm, אבל היעד נישא כסגמנטים של הנתיב:
 * `/auth/confirm/app/shidduchim/<id>` מחזיר ל-`/app/shidduchim/<id>`.
 *
 * זה המסלול היחיד שעובד ל-Magic Link, כי תבנית המייל מוסיפה בעצמה
 * `?token_hash=...&type=...` אל `{{ .RedirectTo }}` — ולכן אי אפשר להעביר
 * שם `?next=`. הנתיב נבנה ב-buildConfirmPath ומסונן שוב ב-confirmMagicLink.
 *
 * catch-all ולא סגמנט יחיד: כך המסלול עובד גם אם משהו בדרך פענח `%2F`
 * חזרה ללוכסנים ופיצל את היעד לכמה סגמנטים.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ next: string[] }> },
) {
  noStore();
  const { next } = await params;
  const target = next?.length ? `/${next.join("/")}` : null;
  return confirmMagicLink(request, target);
}
