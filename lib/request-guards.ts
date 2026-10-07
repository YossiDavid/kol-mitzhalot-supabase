import { getRequestOrigin } from "@/lib/app-url";

/**
 * שומרי בקשה לנתיבי API שמבצעים כתיבה בסשן של המשתמש (עוגיות). העוגיות של
 * Supabase הן SameSite=Lax, ולכן זו שכבת הגנה נוספת מפני בקשות חוצות-אתר.
 */

/**
 * האם הבקשה יצאה מאותו אתר. דפדפנים מודרניים שולחים Sec-Fetch-Site, ואותו
 * אי אפשר לזייף מקוד בדף אחר. בדפדפן ישן בלעדיו נופלים ל-Origin מול ה-host.
 * בקשה בלי אף אחד מהשניים אינה מדפדפן, ולכן נדחית.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(getRequestOrigin(headers)).host;
  } catch {
    return false;
  }
}

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413; error: string };

/**
 * קורא גוף JSON ועוצר ברגע שחצה את המגבלה, גם כשאין Content-Length
 * (למשל Transfer-Encoding: chunked), כדי שגוף ענק לא ייטען לזיכרון.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const tooLarge = {
    ok: false,
    status: 413,
    error: "הבקשה גדולה מדי",
  } as const;

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return tooLarge;
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: "גוף הבקשה חסר" };

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return tooLarge;
    }
    chunks.push(value);
  }

  try {
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "JSON לא תקין" };
  }
}
