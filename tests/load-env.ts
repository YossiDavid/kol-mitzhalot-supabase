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
