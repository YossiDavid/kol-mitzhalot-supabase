import { Phone, User } from "lucide-react";

import {
  cellphoneTypeToHebrew,
  headCoverTypeToHebrew,
  personalStatusToHebrew,
  planForLifeToHebrew,
} from "@/features/students/lib/profile-labels";

import { CardSection } from "./card-section";
import { InfoTag, InfoTagGrid } from "./info-tag";
import type { PersonalDetails } from "./types";

function shidduchimLabel(inShidduchim: boolean | null | undefined) {
  if (inShidduchim === true) return "כן — מיועד לשידוכים";
  if (inShidduchim === false) return "לא";
  return null;
}

/**
 * "פרטים אישיים". אותו רכיב משרת את הגולש המחובר ואת התצוגה הציבורית:
 * בענף הציבורי השדות הרגישים (ת.ז., טלפון, סוג מכשיר, רחוב, מספר בית)
 * אינם קיימים באובייקט כלל, ו-`InfoTag` לא מרנדר אותם.
 */
export function PersonalDetailsSection({
  student,
  genderLabel,
  ageValue,
}: {
  student: PersonalDetails;
  genderLabel: string | null;
  /** "26 שנים" או null - מחושב בכל ענף בנפרד, כדי שתאריך הלידה לא ידלוף */
  ageValue: string | null;
}) {
  return (
    <CardSection title="פרטים אישיים" icon={User}>
      {student.about && (
        <p className="leading-relaxed text-muted-foreground">{student.about}</p>
      )}
      <InfoTagGrid>
        {genderLabel && <InfoTag label="מגדר" value={genderLabel} />}
        <InfoTag
          label="מיועד לשידוכים"
          value={shidduchimLabel(student.in_shidduchim)}
        />
        <InfoTag label="עיר" value={student.city} />
        <InfoTag label="רחוב" value={student.street} />
        <InfoTag label="מספר בית" value={student.house} />
        <InfoTag label="ארץ" value={student.country} />
        <InfoTag label="גיל" value={ageValue} />
        <InfoTag label="תעודת זהות" value={student.identity_number} />
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
