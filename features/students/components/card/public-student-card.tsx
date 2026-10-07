import { MessageSquareText } from "lucide-react";

import { ThirdPartyCardTag } from "@/features/students/components/third-party-card-tag";
import {
  THIRD_PARTY_HIDDEN_PARTS_NOTE,
  type ThirdPartyApprovalColumns,
} from "@/features/students/lib/third-party-card";
import { StaffFeedbackList } from "@/features/students/components/student-notes";
import type { PublicStudent } from "@/features/students/lib/student-card-data";
import { genderToHebrew } from "@/features/students/lib/student-card-data";
import type { StaffFeedback } from "@/features/students/lib/student-notes-data";
import type { StudentPhotoView } from "@/features/students/lib/student-photos";

import { CardSection } from "./card-section";
import { EducationSection, EmploymentSection } from "./education-section";
import { FamilySection } from "./family-section";
import { PersonalDetailsSection } from "./personal-details-section";
import { ReferencesSection } from "./references-section";
import { StudentCardHero } from "./student-card-hero";
import { PublicStudentCardPhoto } from "./student-card-photo";

/**
 * התצוגה הציבורית (גולש לא מחובר שנכנס דרך קישור השיתוף). מוגבלת בכוונה:
 * אין שורת פעולות, אין הערות שדכן, ואין מקטעי "מה אני מחפש"/"הצהרה רפואית"/
 * "נישואין קודמים" - הטבלאות שמזינות אותם לא נשלפות כלל
 * (`ANONYMOUS_STUDENT_SELECT`). הממליצים כן מוצגים במלואם (סוג, שם, טלפון,
 * אימייל) - החלטת הלקוח.
 * פידבק אנשי צוות מוצג גם הוא, לקריאה בלבד. אין קישור חזרה: כל יעד באפליקציה
 * דורש התחברות.
 * תאריך הלידה אינו מגיע לכאן בכלל, ולכן אין בתצוגה הזו גם לחיצה על הגיל.
 */
export function PublicStudentCard({
  studentId,
  student,
  photos,
  staffFeedback,
  thirdParty,
  isBasicOnly = false,
}: {
  thirdParty?: ThirdPartyApprovalColumns;
  /** כרטיס צד שלישי שלא אושר: נתונים בסיסיים בלבד (BASIC) */
  isBasicOnly?: boolean;
  studentId: string;
  student: PublicStudent;
  photos: StudentPhotoView[];
  staffFeedback: StaffFeedback[];
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
        age={student.age}
        personalStatus={student.personal_status}
        gender={student.gender}
        city={student.city}
        height={student.height}
        photo={
          <PublicStudentCardPhoto
            alt={fullName}
            isFemale={student.gender === "female"}
            photos={photos}
          />
        }
        tag={thirdParty ? <ThirdPartyCardTag card={thirdParty} /> : null}
      />

      {/* ללא ת.ז./טלפון/סוג מכשיר/רחוב/בית - הם לא נשלפו בכלל */}
      <PersonalDetailsSection
        student={student}
        genderLabel={genderLabel}
        ageValue={student.age !== null ? `${student.age} שנים` : null}
      />

      {isBasicOnly && (
        <p
          className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-body-sm text-muted-foreground"
          data-testid="third-party-hidden-note"
        >
          {THIRD_PARTY_HIDDEN_PARTS_NOTE}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <FamilySection
            parentsInfo={student.parents_info}
            familyInfo={student.family_info}
          />
        </div>

        <div className="space-y-6">
          <EducationSection education={student.education_history} />
          <EmploymentSection employment={student.employment_history} />
          {!isBasicOnly && (
            <ReferencesSection references={student.references} />
          )}
          {staffFeedback.length > 0 && (
            <CardSection title="פידבק אנשי צוות" icon={MessageSquareText}>
              <StaffFeedbackList
                studentId={studentId}
                initialFeedback={staffFeedback}
                canWrite={false}
              />
            </CardSection>
          )}
        </div>
      </div>
    </div>
  );
}
