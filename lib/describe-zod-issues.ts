import type { z } from "zod";

/**
 * תיאור כשל אימות לרישום בלוג: נתיב השדה וקוד הכשל בלבד. לעולם לא הערך
 * עצמו - שורות הכרטיס מכילות פרטים אישיים (טלפון, כתובת, ת.ז.) ואסור
 * שיגיעו ללוגים. ההודעה של zod אינה נכללת, כי חלק מההודעות מצטטות ערכים.
 */
export function describeZodIssues(
  issues: readonly z.core.$ZodIssue[],
): string[] {
  return issues.map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`,
  );
}
