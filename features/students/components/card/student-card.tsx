import { Lock, MessageSquareText, NotebookPen } from "lucide-react";

import { ThirdPartyCardTag } from "@/features/students/components/third-party-card-tag";
import { THIRD_PARTY_HIDDEN_PARTS_NOTE } from "@/features/students/lib/third-party-card";

import {
  ShadchanNotes,
  StaffFeedbackList,
} from "@/features/students/components/student-notes";
import calculateAge from "@/lib/calculateAge";
import { hebrewBirthDate } from "@/features/students/lib/birth-date-hebrew";
import { getTotalChildrenCount } from "@/features/students/lib/previous-partner-children";
import type { CardBackLink } from "@/features/students/lib/card-back-link";
import { genderToHebrew } from "@/features/students/lib/student-card-data";
import type {
  PrivateNote,
  StaffFeedback,
} from "@/features/students/lib/student-notes-data";
import type { StudentPhotoView } from "@/features/students/lib/student-photos";

import { AuthorInfoCard } from "./author-info-card";
import { CardSection } from "./card-section";
import { EducationSection, EmploymentSection } from "./education-section";
import { FamilySection } from "./family-section";
import { MedicalSection } from "./medical-section";
import { PartnerPreferencesSection } from "./partner-preferences-section";
import {
  PersonalDetailsSection,
  type CardOwnerInfo,
} from "./personal-details-section";
import { PreviousMarriagesSection } from "./previous-marriages-section";
import { ReferencesSection } from "./references-section";
import { StudentCardBackLink, StudentCardHero } from "./student-card-hero";
import { StudentCardPhoto } from "./student-card-photo";

/**
 * שורת הכרטיס המלאה. מגיעה מ-`select("*")` עם embeds, ולכן היא רופפת:
 * עמודות ה-JSON נשמרות כאובייקטים חופשיים.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StudentRow = any;

/**
 * כרטיס המיועד למשתמש מחובר. הפעולות (`actions`) מגיעות מהעמוד, כי הן
 * תלויות בהרשאות (עריכה/מחיקה/עדכון סטטוס) ובכפתורי הלקוח שיושבים לצד הדף.
 */
export function StudentCard({
  student,
  photos,
  photoCount,
  photoPrivate,
  staffFeedback,
  canWriteStaffFeedback,
  currentUserName,
  isShadchan,
  shadchanNotes,
  isProposalView = false,
  showMedical = true,
  owner = null,
  isBasicOnly = false,
  adminControls = null,
  backLink,
  actions,
}: {
  student: StudentRow;
  photos: StudentPhotoView[];
  photoCount: number;
  photoPrivate: boolean;
  staffFeedback: StaffFeedback[];
  canWriteStaffFeedback: boolean;
  currentUserName: string;
  isShadchan: boolean;
  shadchanNotes: PrivateNote[];
  /** הכרטיס נצפה בזכות הצעת שידוך, ולכן חלק מהפרטים אינם נשלפים כלל */
  isProposalView?: boolean;
  /** מקטע ההצהרה הרפואית - מוסתר כשהוא לא נשלף, כדי לא להציג "תקין" שקרי */
  showMedical?: boolean;
  /** מנהל הכרטיס - נמסר מהעמוד למנהל מערכת בלבד, ואחרת לא נמסר כלל */
  owner?: CardOwnerInfo | null;
  /**
   * כרטיס צד שלישי שלא אושר להצגה מלאה, והצופה אינו בעל הכרטיס או מנהל: השרת
   * שלף רק נתונים בסיסיים (BASIC_STUDENT_SELECT), וכאן מוצגת הודעה במקום
   * המקטעים שלא נשלפו
   */
  isBasicOnly?: boolean;
  /** בקרות האישור - למנהל מערכת בלבד, בכרטיס צד שלישי */
  adminControls?: React.ReactNode;
  /** יעד החזרה לפי הצופה (נקבע בעמוד); בלעדיו לא מוצג קישור */
  backLink?: CardBackLink;
  actions: React.ReactNode;
}) {
  // נחשב בשרת: ללקוח עובר רק המחרוזת העברית, לא תאריך הלידה
  const ageHebrewDate = hebrewBirthDate(student.birth_date);
  const genderLabel = genderToHebrew(student.gender);
  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <div className="min-h-screen space-y-6 text-right">
      <StudentCardHero
        firstName={student.first_name}
        lastName={student.last_name}
        nickname={student.nickname}
        genderLabel={genderLabel}
        age={student.birth_date ? calculateAge(student.birth_date) : null}
        ageHebrewDate={ageHebrewDate}
        personalStatus={student.personal_status}
        gender={student.gender}
        childrenCount={getTotalChildrenCount(student.previous_partners)}
        city={student.city}
        height={student.height}
        photo={
          <StudentCardPhoto
            studentId={student.id}
            alt={fullName}
            photoCount={photoCount}
            photoPrivate={photoPrivate}
            photos={photos}
          />
        }
        tag={<ThirdPartyCardTag card={student} />}
        backLink={backLink ? <StudentCardBackLink {...backLink} /> : undefined}
        actions={actions}
      />

      {adminControls}

      {/* הצופה הגיע לכאן מהצעת שידוך. ההודעה מסבירה מה חסר ולמה, כדי
          שהיעדר טלפון או הצהרה רפואית לא ייראה כתקלה או ככרטיס ריק */}
      {isProposalView && (
        <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-body-sm text-muted-foreground">
          הכרטיס מוצג לך בעקבות הצעת השידוך. פרטי ההתקשרות
          {showMedical ? "" : " וההצהרה הרפואית"} אינם מוצגים — לשאלות נוספות
          אפשר לפנות לשדכן.
        </p>
      )}

      {/* היוצא מן הכלל מסומן, לא ברירת המחדל: כרטיס פעיל הוא בשידוכים, ולכן
          רק כרטיס שהוצא מהם נושא הודעה - והפעולות שמפנות אליו חסומות */}
      {student.in_shidduchim === false && (
        <p className="rounded-lg border border-warning bg-warning-muted px-4 py-3 text-body-sm font-bold text-warning-muted-foreground">
          המיועד/ת אינו/ה בשידוכים כרגע. שיתוף הכרטיס ופנייה למנהל הכרטיס
          חסומים.
        </p>
      )}

      <PersonalDetailsSection
        student={student}
        genderLabel={genderLabel}
        ageValue={
          student.birth_date ? `${calculateAge(student.birth_date)} שנים` : null
        }
        ageHebrewDate={ageHebrewDate}
        owner={owner}
      />

      {/* פידבק אנשי צוות - גלוי לכל צופה בכרטיס, וגם בשיתוף */}
      {(staffFeedback.length > 0 || canWriteStaffFeedback) && (
        <CardSection title="פידבק אנשי צוות" icon={MessageSquareText}>
          <StaffFeedbackList
            studentId={student.id}
            initialFeedback={staffFeedback}
            canWrite={canWriteStaffFeedback}
            currentUserName={currentUserName}
          />
        </CardSection>
      )}

      {/* הערות שדכן - לעיני השדכן שכתב אותן בלבד, לא בשיתוף */}
      {isShadchan && (
        <CardSection title="הערות שדכן" icon={NotebookPen}>
          <ShadchanNotes studentId={student.id} initialNotes={shadchanNotes} />
        </CardSection>
      )}

      {isBasicOnly && (
        <p
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-body-sm text-muted-foreground"
          data-testid="third-party-hidden-note"
        >
          <Lock className="size-4 shrink-0" aria-hidden />
          {THIRD_PARTY_HIDDEN_PARTS_NOTE}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <FamilySection
            parentsInfo={student.parents_info}
            familyInfo={student.family_info}
          />
          {!isBasicOnly && (
            <>
              <PreviousMarriagesSection
                partners={student.previous_partners}
                gender={student.gender}
              />
              <PartnerPreferencesSection
                preferences={student.partner_preferences}
                gender={student.gender}
              />
            </>
          )}
        </div>

        <div className="space-y-6">
          <EducationSection education={student.education_history} />
          <EmploymentSection employment={student.employment_history} />
          {!isBasicOnly && (
            <ReferencesSection references={student.references} />
          )}
          {showMedical && !isBasicOnly && (
            <MedicalSection medical={student.medical_records} />
          )}
          <AuthorInfoCard
            authorInfo={student.author_info}
            cardFor={student.card_for}
            canSeeKnowsWell={isShadchan}
          />
        </div>
      </div>
    </div>
  );
}
