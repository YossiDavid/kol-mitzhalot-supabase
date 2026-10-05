import type { User } from "@supabase/supabase-js";

import type { createAdminClient } from "@/lib/supabase/admin";
import { getRoles, type Role } from "@/lib/user-role";

/**
 * כתיבת תפקידים - המקום היחיד בקוד שכותב app_metadata.roles.
 *
 * אבטחה: user_metadata ניתן לכתיבה ע"י המשתמש עצמו, ולכן התפקידים יושבים ב-
 * app_metadata, שרק service role (auth.admin.*) יכול לכתוב. הפונקציה הזו חייבת
 * להיקרא רק משרת, אחרי בדיקת הרשאת מנהל (hasRole(currentUser, "admin")), ורק
 * עם createAdminClient(). אין לייבא אותה מקומפוננטות לקוח.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type UpdateUserRolesResult =
  | { ok: true; user: User; roles: Role[] }
  | { ok: false; status: 404 | 500; message: string };

/** שומרים רק תפקידים אמיתיים: "user" הוא ברירת המחדל המשתמעת (מערך ריק) */
function normalizeRoles(roles: readonly Role[]): Role[] {
  return Array.from(new Set(roles.filter((role) => role !== "user")));
}

/**
 * מחשב את התפקידים החדשים מהקיימים וכותב אותם ל-app_metadata.roles. שולף את
 * המשתמש קודם וממזג את app_metadata הקיים (provider/providers וכו') כדי לא
 * לדרוס אותו.
 */
export async function updateUserRoles(
  admin: AdminClient,
  userId: string,
  computeNextRoles: (existingRoles: Role[]) => readonly Role[],
): Promise<UpdateUserRolesResult> {
  const { data: existing, error: fetchError } =
    await admin.auth.admin.getUserById(userId);

  if (fetchError || !existing.user) {
    return {
      ok: false,
      status: 404,
      message: fetchError?.message || "User not found",
    };
  }

  const nextRoles = normalizeRoles(
    computeNextRoles(getRoles(existing.user)),
  );

  const { data: updated, error: updateError } =
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existing.user.app_metadata,
        roles: nextRoles,
      },
    });

  if (updateError || !updated.user) {
    return {
      ok: false,
      status: 500,
      message: updateError?.message || "Failed to update user roles",
    };
  }

  return { ok: true, user: updated.user, roles: nextRoles };
}
