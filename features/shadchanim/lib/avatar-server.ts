import { createAdminClient } from "@/lib/supabase/admin";

import { isAvatarStoragePath, SHADCHAN_AVATARS_BUCKET } from "./avatar";

/**
 * חתימת תמונות שדכנים - לקוד שרת בלבד. ה-bucket פרטי (קריאה ישירה רק לבעל
 * התמונה ולמנהל), ולכן החתימה ב-service role. ההרשאה היא אחריות הקורא:
 * מעבירים רק כרטיסים שה-RPC הציבורי כבר החזיר לצופה.
 */

/** שעה: מספיק לגלישה בדף, וקישור שדלף לא נשאר בתוקף לאורך זמן */
const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

type WithAvatar = { avatarUrl: string | null };

/** נתיב → קישור חתום; קישור מלא ישן נשאר כמו שהוא. כשל - בלי תמונה */
export async function withSignedAvatars<T extends WithAvatar>(
  cards: readonly T[],
): Promise<T[]> {
  const paths = [
    ...new Set(
      cards.flatMap((card) =>
        card.avatarUrl && isAvatarStoragePath(card.avatarUrl)
          ? [card.avatarUrl]
          : [],
      ),
    ),
  ];
  if (paths.length === 0) return [...cards];

  const signedByPath = await signPaths(paths);
  return cards.map((card) =>
    card.avatarUrl && isAvatarStoragePath(card.avatarUrl)
      ? { ...card, avatarUrl: signedByPath.get(card.avatarUrl) ?? null }
      : card,
  );
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  try {
    const { data, error } = await createAdminClient()
      .storage.from(SHADCHAN_AVATARS_BUCKET)
      .createSignedUrls(paths, AVATAR_SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.error("[shadchanim/avatars] sign", error);
      return new Map();
    }
    return new Map(
      (data ?? []).flatMap((item) =>
        item.path && item.signedUrl && !item.error
          ? [[item.path, item.signedUrl] as const]
          : [],
      ),
    );
  } catch (error) {
    console.error("[shadchanim/avatars] sign", error);
    return new Map();
  }
}
