export type Role = "admin" | "shadchan" | "staff" | "user";

const VALID_ROLES: readonly Role[] = ["admin", "shadchan", "staff", "user"];

function isRole(value: unknown): value is Role {
  return (VALID_ROLES as readonly unknown[]).includes(value);
}

/**
 * User-like object with optional app_metadata.roles. Auth User or similar
 * (an object from getUser()/admin API, or decoded JWT claims - both carry
 * app_metadata).
 *
 * אבטחה: התפקידים נקראים רק מ-app_metadata. user_metadata ניתן לכתיבה ע"י
 * המשתמש עצמו (supabase.auth.updateUser({ data })) ולכן לעולם אין לקרוא ממנו
 * הרשאות. app_metadata נכתב רק ע"י service role (auth.admin.updateUserById).
 */
export type UserWithRole =
  | {
      app_metadata?: Record<string, unknown> | null;
    }
  | null
  | undefined;

/**
 * Returns ALL roles assigned to a user, from `app_metadata.roles` only.
 * Missing/invalid data returns ["user"].
 */
export function getRoles(user: UserWithRole): Role[] {
  const rawRoles = user?.app_metadata?.roles;

  if (Array.isArray(rawRoles)) {
    const validRoles = rawRoles.filter(isRole);
    if (validRoles.length > 0) return validRoles;
  }

  return ["user"];
}

/**
 * Returns whether the user has the given role (via getRoles). Use this for ALL
 * permission checks - a user can legitimately hold multiple roles at once
 * (e.g. shadchan AND staff).
 */
export function hasRole(user: UserWithRole, role: Role): boolean {
  return getRoles(user).includes(role);
}

const ROLE_PRECEDENCE: readonly Role[] = ["admin", "shadchan", "staff", "user"];

/**
 * Given a list of roles, returns the single highest-precedence one:
 * admin > shadchan > staff > user. For DISPLAY / API responses only.
 */
export function pickHighestPrecedenceRole(roles: readonly Role[]): Role {
  for (const candidate of ROLE_PRECEDENCE) {
    if (roles.includes(candidate)) return candidate;
  }
  return "user";
}

/**
 * Returns the single highest-precedence role for a user: admin > shadchan > staff > user.
 */
export function primaryRole(user: UserWithRole): Role {
  return pickHighestPrecedenceRole(getRoles(user));
}

/**
 * Returns the effective role for DISPLAY only (e.g. a label in the admin panel,
 * "you are logged in as X"). Implemented as `primaryRole` so every existing caller
 * keeps compiling and behaves sensibly.
 *
 * IMPORTANT: permission checks must use `hasRole`, not this function — a user can
 * hold multiple roles at once (e.g. shadchan AND staff), and collapsing that down
 * to a single "effective" role is exactly the bug that stripped a real user's
 * shadchan access when they were approved as staff.
 */
export function getEffectiveRole(user: UserWithRole): Role {
  return primaryRole(user);
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "מנהל",
  shadchan: "שדכן",
  staff: "איש צוות",
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
