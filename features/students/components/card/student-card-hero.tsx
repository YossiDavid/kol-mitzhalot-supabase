import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { PageTitle } from "@/components/layout";
import { CONTROL_HEIGHT } from "@/components/ui/control-size";
import { personalStatusToHebrew } from "@/features/students/lib/profile-labels";

/**
 * "חזרה לרשימה" יושב בשורת הפעולות של ההדר ולא בשורה נפרדת מעליה, ולכן הוא
 * לוקח את הגובה מסולם הרכיבים - כדי שיתיישר עם הכפתורים שלצדו.
 */
const BACK_LINK_CLASS = `inline-flex ${CONTROL_HEIGHT.sm} shrink-0 items-center gap-1 rounded-md px-2 text-body-sm text-muted-foreground`;

/** "חזרה לרשימה" - הפריט הראשון בשורת הפעולות של ההדר */
export function StudentCardBackLink() {
  return (
    <Link
      href="/app/students"
      className={`${BACK_LINK_CLASS} transition-colors hover:text-foreground`}
    >
      <ChevronRight className="h-4 w-4" />
      חזרה לרשימה
    </Link>
  );
}

/** אותו מרקאפ בדיוק, בלי קישור - לשלד הטעינה */
export function StudentCardBackLinkPlaceholder() {
  return (
    <span className={BACK_LINK_CLASS}>
      <ChevronRight className="h-4 w-4" />
      חזרה לרשימה
    </span>
  );
}

/** פריט בשורת המטא, עם המפריד שלפניו. המגדר הוא הפריט היחיד בלי מפריד */
function MetaItem({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="text-muted-foreground/40">·</span>
      <span>{children}</span>
    </>
  );
}

/**
 * ראש הכרטיס: תמונה, שם ושורת מטא (מגדר · גיל · סטטוס · עיר · גובה).
 *
 * שורת הפעולות מחזיקה את "חזרה לרשימה" (`backLink`) ואת הפעולות (`actions`)
 * באותה שורה, כדי שההדר יישאר שורה אחת. `actions` נשלח רק בתצוגה של משתמש
 * מחובר; בתצוגה הציבורית יש קישור חזרה בלבד.
 */
export function StudentCardHero({
  firstName,
  lastName,
  genderLabel,
  age,
  personalStatus,
  gender,
  city,
  height,
  photo,
  backLink,
  actions,
}: {
  firstName: string;
  lastName: string;
  genderLabel: string | null;
  age: string | number | null;
  personalStatus: string | null | undefined;
  gender: string | null | undefined;
  city: string | null | undefined;
  height: number | null | undefined;
  photo: React.ReactNode;
  backLink?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="shrink-0">{photo}</div>

      <div className="min-w-0 flex-1">
        <PageTitle>
          {firstName} {lastName}
        </PageTitle>
        <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-body-sm text-muted-foreground">
          {genderLabel && <span>{genderLabel}</span>}
          {age !== null && <MetaItem>גיל {age}</MetaItem>}
          {personalStatus && (
            <MetaItem>
              {personalStatusToHebrew(personalStatus, gender ?? undefined)}
            </MetaItem>
          )}
          {city && <MetaItem>{city}</MetaItem>}
          {height && <MetaItem>{height} ס"מ</MetaItem>}
        </p>
      </div>

      {backLink || actions ? (
        <div
          data-slot="student-card-actions"
          className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end"
        >
          {backLink}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
