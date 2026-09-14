// שם תצוגה, ראשי תיבות ותמונה של הצד השני בשיחה, מתוך get_user_metadata.

export type UserMetadata = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatar_url?: string | null;
} | null;

const FALLBACK_ID_LENGTH = 8;

export function getDisplayName(userData: UserMetadata, userId: string): string {
  if (userData?.firstName || userData?.lastName) {
    return `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
  }
  if (userData?.email) return userData.email.split("@")[0];
  return userId.substring(0, FALLBACK_ID_LENGTH);
}

/** הפונקציה לא תמיד מחזירה avatar_url — כשאין, מוצגים ראשי תיבות. */
export function getAvatarUrl(userData: UserMetadata): string | null {
  const url = userData?.avatar_url?.trim();
  return url ? url : null;
}

export function getInitials(name: string): string {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
