import * as fs from "fs";
import * as path from "path";

/**
 * טוען משתני סביבה מקובץ .env לתוך process.env.
 *
 * Playwright, בשונה מ-next dev, אינו קורא את קובצי ה-.env של הפרויקט. בלי
 * הטעינה הזו auth.setup.ts מקבל undefined ב-NEXT_PUBLIC_SUPABASE_URL ונכשל
 * עוד לפני הבדיקה הראשונה.
 *
 * משתנה שכבר קיים בסביבה גובר על הקובץ, כדי ש-CI יוכל לדרוס בלי לערוך קבצים.
 */
export function loadEnvFile(fileName = ".env.local"): void {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || key in process.env) continue;

    process.env[key] = stripQuotes(line.slice(separator + 1).trim());
  }
}

function stripQuotes(value: string): string {
  if (value.length < 2) return value;

  const isQuoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));

  return isQuoted ? value.slice(1, -1) : value;
}

const LOCAL_SUPABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * מסרב להריץ את הבדיקות מול Supabase שאינו מקומי.
 *
 * הבדיקות כותבות נתונים אמיתיים — מיועדים והצעות שידוך — ולא כל מה שהן
 * יוצרות מנוקה. הקובץ .env.cloud.local יושב לצד .env.local ומכיל מפתח
 * service role שעוקף RLS, ולכן העתקה אחת מספיקה כדי שריצה מקומית תיגע
 * בסביבה אמיתית. חריגה מודעת בלבד: ALLOW_REMOTE_E2E=true.
 */
export function assertLocalSupabase(): void {
  if (process.env.ALLOW_REMOTE_E2E === "true") return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL חסר — בלי כתובת אי אפשר לוודא שהיעד מקומי",
    );
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL אינו כתובת תקינה: ${url}`);
  }

  if (LOCAL_SUPABASE_HOSTS.has(host)) return;

  throw new Error(
    "בדיקות ה-e2e כותבות נתונים אמיתיים, ולכן הן רצות רק מול Supabase מקומי.\n" +
      `היעד שהוגדר הוא ${host}.\n` +
      "אם זו סביבת בדיקות ייעודית ולא פרודקשן, הרץ עם ALLOW_REMOTE_E2E=true.",
  );
}
