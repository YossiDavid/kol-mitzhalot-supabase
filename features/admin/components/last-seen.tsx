import {
  formatDateTimeIsrael,
  formatRelativeTime,
} from "@/lib/relative-time";

type LastSeenProps = {
  /** user_profiles.last_seen_at */
  lastSeenAt: string | null;
  /** auth.users.last_sign_in_at - כשאין עדיין "נראה לאחרונה" */
  lastSignInAt: string | null;
};

/**
 * "נראה לאחרונה" בניהול המשתמשים: זמן יחסי, והתאריך המלא ב-title. משתמש שלא
 * נראה מאז שהעמודה נוספה - לפי ההתחברות האחרונה, עם ציון שזו התחברות.
 */
export function LastSeen({ lastSeenAt, lastSignInAt }: LastSeenProps) {
  const value = lastSeenAt ?? lastSignInAt;
  if (!value) {
    return <span className="text-muted-foreground">לא נראה</span>;
  }
  return (
    <time
      dateTime={value}
      title={formatDateTimeIsrael(value)}
      data-testid="last-seen"
      data-source={lastSeenAt ? "seen" : "sign-in"}
    >
      {formatRelativeTime(value)}
      {!lastSeenAt && (
        <span className="text-caption text-muted-foreground"> (התחברות)</span>
      )}
    </time>
  );
}
