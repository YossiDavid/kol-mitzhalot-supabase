/**
 * חגיגת השידוכים בבדיקות: המתג (כבוי בשאר הבדיקות - auth.setup.ts), זריעת
 * מצב החגיגה של משתמש, ומודעות אירוסין זמניות.
 * Callers: engagements/shidduch-celebration.spec.ts.
 */
import { serviceClient } from "./dedications";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function setCelebrationsEnabled(
  isEnabled: boolean,
): Promise<void> {
  const { error } = await serviceClient()
    .from("system_settings")
    .upsert({ key: "celebrations_enabled", value: isEnabled });
  if (error) throw new Error(`עדכון מתג החגיגה נכשל: ${error.message}`);
}

/** מצב החגיגה: ראה חגיגה ונכנס לאחרונה לפני daysAgo ימים */
export async function seedCelebrationState(
  userId: string,
  daysAgo: number,
): Promise<void> {
  const at = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  const { error } = await serviceClient()
    .from("user_celebration_state")
    .upsert({ user_id: userId, seen_at: at, last_entry_at: at });
  if (error) throw new Error(`זריעת מצב החגיגה נכשלה: ${error.message}`);
}

export async function readCelebrationState(
  userId: string,
): Promise<{ seenAt: Date; lastEntryAt: Date } | null> {
  const { data } = await serviceClient()
    .from("user_celebration_state")
    .select("seen_at, last_entry_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    seenAt: new Date(data.seen_at as string),
    lastEntryAt: new Date(data.last_entry_at as string),
  };
}

/** מודעת אירוסין כמו ששידוך שנסגר במערכת יוצר (source='system') */
export async function insertSystemEngagement(label: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("engagements")
    .insert({
      groom_name: `חתן ${label}`,
      bride_name: `כלה ${label}`,
      source: "system",
      is_published: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת מודעה נכשלה: ${error?.message}`);
  return data.id as string;
}

export async function deleteEngagements(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await serviceClient().from("engagements").delete().in("id", ids);
}
