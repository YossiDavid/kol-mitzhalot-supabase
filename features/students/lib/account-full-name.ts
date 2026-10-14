import type { User } from "@supabase/supabase-js";

import { formatFullName, resolveDisplayName } from "@/lib/user-display-name";

/**
 * שם החשבון (פרטי + משפחה, מהמטא-דאטה של ההרשמה) למילוי מראש של שם מנהל/ת
 * הכרטיס. null כשאין שם. מילוי מראש בלבד - ניתן לעריכה, לא החלטת הרשאה.
 */
export function accountFullName(user: User): string | null {
  const { firstName, lastName } = resolveDisplayName(user);
  return formatFullName(firstName, lastName) || null;
}
