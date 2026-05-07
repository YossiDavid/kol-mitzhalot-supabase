export type Role = "admin" | "shadchan" | "user";

/** User-like object with optional user_metadata.role (Auth User or similar). */
export type UserWithRole =
  | { user_metadata?: { role?: string | null } | null }
  | null
  | undefined;

/**
 * Returns the effective role for display and UI. Missing/undefined role is treated as "user".
 * Use this whenever you need a single, consistent role value (e.g. labels in admin).
 * Safe to import from client components (no server-only).
 */
export function getEffectiveRole(user: UserWithRole): Role {
  const role = user?.user_metadata?.role;
  if (role === "admin" || role === "shadchan" || role === "user") return role;
  return "user";
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "מנהל",
  shadchan: "שדכן",
  user: "משתמש",
};

/** Returns Hebrew label for a role (uses getEffectiveRole if given a user object). */
export function getRoleLabel(
  roleOrUser: Role | string | null | undefined | UserWithRole,
): string {
  if (roleOrUser == null) return ROLE_LABELS.user;
  const role =
    typeof roleOrUser === "string" ? roleOrUser : getEffectiveRole(roleOrUser);
  return ROLE_LABELS[role as Role] ?? ROLE_LABELS.user;
}
