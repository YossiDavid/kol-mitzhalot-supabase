import { Mail, Phone, User } from "lucide-react";
import Link from "next/link";

import {
  cellphoneTypeToHebrew,
  headCoverTypeToHebrew,
  personalStatusToHebrew,
  planForLifeToHebrew,
} from "@/features/students/lib/profile-labels";

import { AgeBirthDate } from "./age-birth-date";
import { CardSection } from "./card-section";
import { InfoTag, InfoTagGrid } from "./info-tag";
import type { PersonalDetails } from "./types";

/** מנהל הכרטיס (החשבון שבבעלותו הכרטיס) - נמסר למנהל מערכת בלבד */
export type CardOwnerInfo = {
  userId: string;
  /** null כשהאימייל לא נמצא או שהשליפה נכשלה */
  email: string | null;
};

/**
 * "פרטים אישיים". אותו רכיב משרת את הגולש המחובר ואת התצוגה הציבורית:
 * בענף הציבורי השדות הרגישים (טלפון, סוג מכשיר, רחוב, מספר בית)
 * אינם קיימים באובייקט כלל, ו-`InfoTag` לא מרנדר אותם.
 */
export function PersonalDetailsSection({
  student,
  genderLabel,
  ageValue,
  ageHebrewDate,
  owner,
}: {
  student: PersonalDetails;
  genderLabel: string | null;
  /** "26 שנים" או null - מחושב בכל ענף בנפרד, כדי שתאריך הלידה לא ידלוף */
  ageValue: string | null;
  /** תאריך הלידה העברי, לחשיפה בלחיצה על הגיל. לא נמסר בתצוגה הציבורית */
  ageHebrewDate?: string | null;
  /** אימייל מנהל הכרטיס וקישור לפרטיו - מנהל מערכת בלבד */
  owner?: CardOwnerInfo | null;
}) {
  return (
    <CardSection title="פרטים אישיים" icon={User}>
      {student.about && (
        <p className="leading-relaxed text-muted-foreground">{student.about}</p>
      )}
      <InfoTagGrid>
        {/* "מיועד לשידוכים" אינו מוצג כאן: כרטיס פעיל הוא בשידוכים כברירת
            מחדל, והיוצא מן הכלל מסומן בהבלטה בראש הכרטיס */}
        {genderLabel && <InfoTag label="מגדר" value={genderLabel} />}
        <InfoTag label="עיר" value={student.city} />
        <InfoTag label="רחוב" value={student.street} />
        <InfoTag label="מספר בית" value={student.house} />
        <InfoTag label="ארץ" value={student.country} />
        {ageValue && (
          <div className="flex flex-col">
            <span className="text-caption font-medium text-muted-foreground">
              גיל
            </span>
            <AgeBirthDate
              label={ageValue}
              hebrewDate={ageHebrewDate}
              className="self-start text-body-sm font-semibold text-foreground"
            />
          </div>
        )}
        <InfoTag
          label="סטטוס אישי"
          value={
            student.personal_status
              ? personalStatusToHebrew(
                  student.personal_status,
                  student.gender ?? undefined,
                )
              : null
          }
        />
        <InfoTag
          label="גובה"
          value={student.height ? `${student.height} ס"מ` : null}
        />
        <InfoTag label="קהילה" value={student.community} />
        <InfoTag label="שטיבל" value={student.shtible} />
        <InfoTag
          label="סוג מכשיר"
          value={
            student.cellphone_type
              ? cellphoneTypeToHebrew(student.cellphone_type)
              : null
          }
        />
        {student.phone && (
          <div className="flex flex-col">
            <span className="text-caption font-medium text-muted-foreground">
              טלפון
            </span>
            <a
              href={`tel:${student.phone}`}
              className="flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline"
            >
              <Phone size={12} /> {student.phone}
            </a>
          </div>
        )}
        {owner && (
          <div className="flex flex-col" data-slot="card-owner">
            <span className="text-caption font-medium text-muted-foreground">
              אימייל מנהל הכרטיס
            </span>
            {owner.email ? (
              <a
                href={`mailto:${owner.email}`}
                className="flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline"
              >
                <Mail size={12} /> {owner.email}
              </a>
            ) : (
              <span className="text-body-sm text-muted-foreground">
                לא זמין
              </span>
            )}
            <Link
              href={`/app/admin/users/${owner.userId}`}
              className="text-caption text-primary hover:underline"
            >
              פרטי המשתמש
            </Link>
          </div>
        )}
        <InfoTag
          label="תכנון לחיים"
          value={
            student.plan_for_life
              ? planForLifeToHebrew(student.plan_for_life)
              : null
          }
        />
        <InfoTag
          label="סוג כיסוי ראש"
          value={
            student.head_cover_type
              ? headCoverTypeToHebrew(student.head_cover_type)
              : null
          }
        />
      </InfoTagGrid>
    </CardSection>
  );
}
