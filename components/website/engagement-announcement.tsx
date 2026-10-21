import { jewishDateHebrew } from "@/lib/jewishDatte";
import { cn } from "@/lib/utils";

/**
 * מודעת מאורסים בעימוד המסורתי - החתן מימין והכלה משמאל (שם, "בהר"ר" +
 * שם האב, ישיבה/סמינר, עיר), "מאורסים" במרכז ותאריך עברי - בפונט ובצבעים
 * של האתר. שדה ריק פשוט לא מוצג.
 */

/** העמודות שהמודעה צריכה - לשאילתות בדף הבית וב"מה חדש" */
export const ENGAGEMENT_ANNOUNCEMENT_COLUMNS =
  "id, groom_name, groom_father, groom_yeshiva, groom_city, bride_name, bride_father, bride_seminary, bride_city, closed_at, created_at";

export interface EngagementAnnouncementData {
  id: string;
  groom_name: string;
  groom_father: string | null;
  groom_yeshiva: string | null;
  groom_city: string | null;
  bride_name: string;
  bride_father: string | null;
  bride_seminary: string | null;
  bride_city: string | null;
  closed_at: string | null;
  created_at: string | null;
}

interface PartyProps {
  name: string;
  father: string | null;
  institution: string | null;
  city: string | null;
  align: "start" | "end";
}

function Party({ name, father, institution, city, align }: PartyProps) {
  const details = [
    father?.trim() ? `בהר״ר ${father.trim()}` : null,
    institution?.trim() || null,
    city?.trim() || null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div
      className={cn(
        "min-w-0 flex-1",
        align === "start" ? "text-start" : "text-end",
      )}
    >
      <p className="m-0 text-subtitle leading-tight font-bold text-primary sm:text-title">
        {name}
      </p>
      {details.map((line) => (
        <p
          key={line}
          className="m-0 text-body-sm leading-snug text-muted-foreground sm:text-body"
        >
          {line}
        </p>
      ))}
    </div>
  );
}

/** עיטור עדין לפינת המסגרת הפנימית; מסובב לכל פינה */
function CornerOrnament({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute size-6 text-primary/60 sm:size-8",
        className,
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 22 C3 11 11 3 22 3" />
      <path d="M22 3 C17 5 16 10 20 11 C23 12 24 8 21 7" />
      <path d="M3 22 C5 17 10 16 11 20 C12 23 8 24 7 21" />
      <circle cx="10" cy="10" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function announcementDate(data: EngagementAnnouncementData): string | null {
  const date = data.closed_at ?? data.created_at;
  if (!date) return null;
  try {
    return jewishDateHebrew(date);
  } catch {
    return null;
  }
}

export function EngagementAnnouncement({
  data,
}: {
  data: EngagementAnnouncementData;
}) {
  const hebrewDate = announcementDate(data);

  return (
    <article
      className="rounded-[14px] border-2 border-border bg-card p-2"
      data-testid="engagement-announcement"
    >
      <div className="relative rounded-[10px] border-2 border-primary/30 px-6 pt-5 pb-4 sm:px-9 sm:pt-6">
        <CornerOrnament className="top-1 right-1 -scale-x-100" />
        <CornerOrnament className="top-1 left-1" />
        <CornerOrnament className="right-1 bottom-1 rotate-180" />
        <CornerOrnament className="bottom-1 left-1 -scale-y-100" />

        <div className="flex gap-4 sm:gap-8">
          <Party
            name={data.groom_name}
            father={data.groom_father}
            institution={data.groom_yeshiva}
            city={data.groom_city}
            align="start"
          />
          <Party
            name={data.bride_name}
            father={data.bride_father}
            institution={data.bride_seminary}
            city={data.bride_city}
            align="end"
          />
        </div>

        <p className="m-0 mt-3 text-center text-display leading-none font-bold text-primary">
          מאורסים
        </p>
        {hebrewDate ? (
          <p className="m-0 mt-2 text-center text-body-sm text-muted-foreground">
            בס״ד, {hebrewDate}
          </p>
        ) : null}
      </div>
    </article>
  );
}
