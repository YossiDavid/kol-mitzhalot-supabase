import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { SIGNUP_PURPOSE_METADATA_KEY } from "../../../features/auth/lib/signup-purpose";

/**
 * מייל אישור ההרשמה (email-templates/supabase/confirm-signup.html) מוסיף הבהרה
 * רק למי שנרשם כשדכן (user_metadata.signup_purpose = shadchan).
 *
 * בדיקה סטטית של התבנית בלבד, ולא קריאת מייל מ-Mailpit: ב-Supabase המקומי
 * enable_confirmations=false, ולכן נרשם חדש מקבל שם את מייל "התחברות"
 * (Magic Link) ולא את תבנית "אישור הרשמה" - אי אפשר להגיע אליה מקומית.
 * התבנית נבדקת כאן מבנית (תנאי, איזון {{ end }}, מפתח המטא-דאטה), והרינדור
 * האמיתי נבדק רק בפרודקשן אחרי הדבקת התבנית ב-Dashboard.
 */
const TEMPLATE = readFileSync(
  join(process.cwd(), "email-templates/supabase/confirm-signup.html"),
  "utf8",
);
const SHADCHAN_CONDITION = `eq .Data.${SIGNUP_PURPOSE_METADATA_KEY} "shadchan"`;
const NOTE = "נרשמת כשדכן/ית";

/** מוחק הערות HTML, שמכילות דוגמאות משתנים ואינן חלק מהמייל */
const withoutComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");

test.describe("תבנית מייל אישור הרשמה - הבהרה לשדכן", () => {
  test("ההבהרה נמצאת רק בתוך תנאי הנרשם כשדכן", () => {
    // Arrange
    const html = withoutComments(TEMPLATE);
    const conditionAt = html.indexOf(SHADCHAN_CONDITION);
    const noteAt = html.indexOf(NOTE);
    const closeAt = html.indexOf("{{ end }}{{ end }}");

    // Assert
    expect(conditionAt).toBeGreaterThan(-1);
    expect(noteAt).toBeGreaterThan(conditionAt);
    expect(closeAt).toBeGreaterThan(noteAt);
    expect(html.split(NOTE)).toHaveLength(2);
  });

  test("ההבהרה מפנה להגדרות ← הצטרפות כשדכן ולטופס הבקשה", () => {
    const html = withoutComments(TEMPLATE);

    expect(html).toContain("הגדרות");
    expect(html).toContain("הצטרפות כשדכן");
    expect(html).toContain("טופס הבקשה");
  });

  test("כל תנאי בתבנית נסגר, והגישה למטא-דאטה מוגנת מערך חסר", () => {
    const html = withoutComments(TEMPLATE);
    const opens = html.match(/\{\{\s*if\b/g)?.length ?? 0;
    const ends = html.match(/\{\{\s*end\s*\}\}/g)?.length ?? 0;

    expect(opens).toBe(ends);
    // מגינים על ה-eq בבדיקת קיום, כדי שמשתמש בלי המפתח לא יפיל את המייל
    expect(html).toContain(`{{ if .Data.${SIGNUP_PURPOSE_METADATA_KEY} }}`);
  });

  test("הבהרה לנרשם כאיש צוות: בתוך תנאי staff, ומפנה להצטרפות כאיש צוות", () => {
    // Arrange
    const html = withoutComments(TEMPLATE);
    const staffCondition = `eq .Data.${SIGNUP_PURPOSE_METADATA_KEY} "staff"`;
    const staffNote = "נרשמת כאיש/ת צוות";
    const conditionAt = html.indexOf(staffCondition);
    const noteAt = html.indexOf(staffNote);
    const closeAt = html.indexOf("{{ end }}{{ end }}", noteAt);

    // Assert
    expect(conditionAt).toBeGreaterThan(-1);
    expect(noteAt).toBeGreaterThan(conditionAt);
    expect(closeAt).toBeGreaterThan(noteAt);
    expect(html.split(staffNote)).toHaveLength(2);
    expect(html).toContain("הצטרפות כאיש צוות");
  });
});
