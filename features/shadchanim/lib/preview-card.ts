import type { User } from "@supabase/supabase-js";

import { resolveDisplayName } from "@/lib/user-display-name";

import { toPublicCard } from "./card-mapping";
import { toList, type ShadchanFormData } from "./profile-form";
import type { ShadchanPublicCard } from "./types";

/** מי שהכרטיס מייצג: השם והתמונה אינם חלק מהטופס */
export interface PreviewIdentity {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

const NO_EXPERIENCE_FALLBACK_OFFSET = 0;

/**
 * שנת תחילת העיסוק כפי ש-shadchan_public_profiles מחשבת: שנה נוכחית פחות
 * שנות ניסיון (בהגשה, שנת ההגשה היא השנה הנוכחית). בלי ניסיון תקין: השנה.
 */
function sinceYearOf(experienceYears: string, now: Date): number {
  const years = Number.parseInt(experienceYears, 10);
  const safeYears =
    Number.isFinite(years) && years >= 0
      ? years
      : NO_EXPERIENCE_FALLBACK_OFFSET;
  return now.getFullYear() - safeYears;
}

/**
 * ערכי הטופס (גם לא מאומתים, בזמן הקלדה) → הכרטיס שיוצג ברשימת השדכנים,
 * דרך אותו מיפוי של הרשימה (toPublicCard). ריק נשאר null כמו ב-SQL (NULLIF).
 */
export function formToPreviewCard(
  values: Partial<ShadchanFormData>,
  identity: PreviewIdentity,
  now: Date = new Date(),
): ShadchanPublicCard {
  const clean = (value: string | undefined) => value?.trim() || null;
  return toPublicCard({
    shadchan_id: identity.id,
    first_name: identity.firstName,
    last_name: identity.lastName,
    avatar_url: identity.avatarUrl,
    since_year: sinceYearOf(values.experience_years ?? "", now),
    city: clean(values.location),
    description: clean(values.bio),
    specializations: toList(values.specializations ?? "") ?? [],
  });
}

/** המשתמש (ושורת הפרופיל שלו, אם יש) → זהות לתצוגה המקדימה */
export function identityFromUser(
  user: User,
  profile?: { first_name: string | null; last_name: string | null } | null,
): PreviewIdentity {
  const { firstName, lastName } = resolveDisplayName(user, profile);
  const avatar = user.user_metadata?.avatar_url;
  return {
    id: user.id,
    firstName,
    lastName,
    avatarUrl: typeof avatar === "string" && avatar.trim() ? avatar : null,
  };
}
