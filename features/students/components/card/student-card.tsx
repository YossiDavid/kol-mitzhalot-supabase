import { MessageSquareText, NotebookPen } from "lucide-react";

import {
  ShadchanNotes,
  StaffFeedbackList,
} from "@/features/students/components/student-notes";
import calculateAge from "@/lib/calculateAge";
import { getTotalChildrenCount } from "@/features/students/lib/previous-partner-children";
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
import { PersonalDetailsSection } from "./personal-details-section";
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
  actions: React.ReactNode;
}) {
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
        backLink={<StudentCardBackLink />}
        actions={actions}
      />

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <FamilySection
            parentsInfo={student.parents_info}
            familyInfo={student.family_info}
          />
          <PreviousMarriagesSection
            partners={student.previous_partners}
            gender={student.gender}
          />
          <PartnerPreferencesSection
            preferences={student.partner_preferences}
            gender={student.gender}
          />
        </div>

        <div className="space-y-6">
          <EducationSection education={student.education_history} />
          <EmploymentSection employment={student.employment_history} />
          <ReferencesSection references={student.references} />
          <MedicalSection medical={student.medical_records} />
          <AuthorInfoCard authorInfo={student.author_info} />
        </div>
      </div>
    </div>
  );
}
