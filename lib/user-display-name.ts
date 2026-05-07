import type { User } from "@supabase/supabase-js";

/** שם תצוגה: metadata (camel/snake/full_name) ואז user_profiles */
export function resolveDisplayName(
  user: User,
  profile?: { first_name: string | null; last_name: string | null } | null,
): { firstName: string | null; lastName: string | null } {
  const m = user.user_metadata || {};
  let first =
    (typeof m.firstName === "string" && m.firstName.trim()) ||
    (typeof m.first_name === "string" && m.first_name.trim()) ||
    profile?.first_name?.trim() ||
    null;
  let last =
    (typeof m.lastName === "string" && m.lastName.trim()) ||
    (typeof m.last_name === "string" && m.last_name.trim()) ||
    profile?.last_name?.trim() ||
    null;

  if (!first && !last) {
    const combined =
      (typeof m.full_name === "string" && m.full_name.trim()) ||
      (typeof m.fullName === "string" && m.fullName.trim()) ||
      (typeof m.name === "string" && m.name.trim()) ||
      null;
    if (combined) {
      const parts = combined.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        first = parts[0] ?? null;
        last = parts.slice(1).join(" ") || null;
      } else if (parts.length === 1) {
        first = parts[0] ?? null;
      }
    }
  }

  return { firstName: first, lastName: last };
}

/** שם מלא להצגה (למשל באדמין) */
export function formatFullName(
  firstName: string | null,
  lastName: string | null,
): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

/** שם פרטי ושם משפחה — שניהם חובה */
export function hasRequiredFullName(
  user: User,
  profile?: { first_name: string | null; last_name: string | null } | null,
): boolean {
  const { firstName, lastName } = resolveDisplayName(user, profile);
  return Boolean(firstName?.trim() && lastName?.trim());
}
