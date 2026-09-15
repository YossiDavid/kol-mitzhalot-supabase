// שם תצוגה, ראשי תיבות ותמונה של הצד השני בשיחה, מתוך get_user_metadata.

export type UserMetadata = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatar_url?: string | null;
} | null;

/** כשאין שם ואין אימייל - לעולם לא מזהה (uid), שאינו אומר כלום למשתמש */
export const UNKNOWN_USER_NAME = "משתמש/ת";

export function getDisplayName(userData: UserMetadata): string {
  if (userData?.firstName || userData?.lastName) {
    return `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
  }
  if (userData?.email) return userData.email.split("@")[0];
  return UNKNOWN_USER_NAME;
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
