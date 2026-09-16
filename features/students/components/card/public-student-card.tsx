import { MessageSquareText } from "lucide-react";

import { StaffFeedbackList } from "@/features/students/components/student-notes";
import type { PublicStudent } from "@/features/students/lib/student-card-data";
import { genderToHebrew } from "@/features/students/lib/student-card-data";
import type { StaffFeedback } from "@/features/students/lib/student-notes-data";
import type { StudentPhotoView } from "@/features/students/lib/student-photos";

import { CardSection } from "./card-section";
import { EducationSection, EmploymentSection } from "./education-section";
import { FamilySection } from "./family-section";
import { PersonalDetailsSection } from "./personal-details-section";
import { StudentCardBackLink, StudentCardHero } from "./student-card-hero";
import { PublicStudentCardPhoto } from "./student-card-photo";

/**
 * התצוגה הציבורית (גולש לא מחובר שנכנס דרך קישור השיתוף). מוגבלת בכוונה:
 * אין שורת פעולות, אין הערות שדכן, ואין מקטעי "מה אני מחפש"/"הצהרה רפואית"/
 * "ממליצים"/"נישואין קודמים" - הטבלאות שמזינות אותם לא נשלפות כלל
 * (`ANONYMOUS_STUDENT_SELECT`). פידבק אנשי צוות כן מוצג, לקריאה בלבד.
 */
export function PublicStudentCard({
  studentId,
  student,
  photos,
  staffFeedback,
}: {
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
        backLink={<StudentCardBackLink />}
      />

      {/* ללא ת.ז./טלפון/סוג מכשיר/רחוב/בית - הם לא נשלפו בכלל */}
      <PersonalDetailsSection
        student={student}
        genderLabel={genderLabel}
        ageValue={student.age !== null ? `${student.age} שנים` : null}
      />

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
