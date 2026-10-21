import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApplicationStatus } from "@/lib/application-status";

/**
 * בקשת הצטרפות של משתמש (שדכן או איש צוות) כפי שהמנהל רואה אותה בפרטי
 * המשתמש. null = המשתמש לא הגיש בקשה.
 */
export type UserApplicationSummary = {
  /** null = שורה בלי סטטוס (שדכן ותיק שנוסף לפני מנגנון הבקשות) */
  status: ApplicationStatus | null;
  submittedAt: string | null;
  /** הקפאת שדכן (shadchanim_info.frozen_at); לאיש צוות תמיד null */
  frozenAt: string | null;
};

export type UserApplications = {
  shadchan: UserApplicationSummary | null;
  staff: UserApplicationSummary | null;
};

/** העוגן של כרטיס הבקשה בעמודי הבקשות - פרטי המשתמש מקשרים אליו */
export function applicationAnchorId(userId: string): string {
  return `request-${userId}`;
}

export const SHADCHAN_REQUESTS_PATH = "/app/admin/shadchanim/requests";
export const STAFF_REQUESTS_PATH = "/app/admin/staff/requests";

/** שתי הבקשות של המשתמש; admin client כי מדובר בשורות של משתמש אחר */
export async function getUserApplications(
  adminClient: SupabaseClient,
  userId: string,
): Promise<UserApplications> {
  const [shadchanResult, staffResult] = await Promise.all([
    adminClient
      .from("shadchanim_info")
      .select("application_status, submitted_at, frozen_at")
      .eq("user_id", userId)
      .maybeSingle(),
    adminClient
      .from("staff_info")
      .select("application_status, submitted_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (shadchanResult.error) {
    console.error("Error fetching shadchanim_info:", shadchanResult.error);
  }
  if (staffResult.error) {
    console.error("Error fetching staff_info:", staffResult.error);
  }

  const shadchanRow = shadchanResult.data;
  const staffRow = staffResult.data;

  return {
    shadchan: shadchanRow
      ? {
          status: shadchanRow.application_status,
          submittedAt: shadchanRow.submitted_at,
          frozenAt: shadchanRow.frozen_at,
        }
      : null,
    staff: staffRow
      ? {
          status: staffRow.application_status,
          submittedAt: staffRow.submitted_at,
          frozenAt: null,
        }
      : null,
  };
}
