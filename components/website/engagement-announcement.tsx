import { Frank_Ruhl_Libre } from "next/font/google";

import { jewishDateHebrew } from "@/lib/jewishDatte";
import { cn } from "@/lib/utils";

/**
 * מודעת מאורסים בעיצוב המסורתי: מסגרת מעוטרת, החתן מימין והכלה משמאל
 * (שם, "בהר"ר" + שם האב, ישיבה/סמינר, עיר), "מאורסים" במרכז ותאריך עברי.
 * שדה ריק פשוט לא מוצג.
 */

const announcementFont = Frank_Ruhl_Libre({
  subsets: ["hebrew"],
  weight: ["500", "900"],
  display: "swap",
});

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
      <p className="m-0 text-subtitle leading-tight font-black sm:text-title">
        {name}
      </p>
      {details.map((line) => (
        <p
          key={line}
          className="m-0 text-body-sm leading-snug font-medium sm:text-body"
        >
          {line}
        </p>
      ))}
    </div>
  );
}

/** תלתל קישוט לפינה; מסובב לכל פינה */
function CornerFlourish({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("absolute size-7 sm:size-9", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M4 36 C4 18 10 6 30 4" />
      <path d="M30 4 C22 8 20 14 26 16 C31 17 32 11 28 10" />
      <path d="M4 36 C8 28 14 26 16 32 C17 37 11 38 10 34" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
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
      className={cn(
        announcementFont.className,
        "relative bg-white p-2 text-neutral-900 shadow-sm",
      )}
      data-testid="engagement-announcement"
    >
      <div className="relative border-[3px] border-double border-neutral-800 px-5 pt-5 pb-4 sm:px-8 sm:pt-6">
        <CornerFlourish className="-top-1 -right-1 -scale-x-100" />
        <CornerFlourish className="-top-1 -left-1" />
        <CornerFlourish className="-right-1 -bottom-1 rotate-180" />
        <CornerFlourish className="-bottom-1 -left-1 -scale-y-100" />

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

        <p className="m-0 mt-2 text-center text-display leading-none font-black tracking-wide">
          מאורסים
        </p>
        {hebrewDate ? (
          <p className="m-0 mt-2 text-center text-body-sm font-medium sm:text-body">
            בס״ד, {hebrewDate}
          </p>
        ) : null}
      </div>
    </article>
  );
}
