"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { StudentFormValues } from "@/features/students/components/create-form/schema";
import type { StudentPhotoItem } from "@/features/students/lib/student-photo-rules";
import {
  StudentFormWizard,
  type StudentFormWizardProps,
} from "@/features/students/lib/student-form-wizard";
import {
  buildStudentPayload,
  mapCellphoneType,
  missingRequiredStudentFields,
} from "@/features/students/lib/build-student-payload";
import {
  saveStudentPhotos,
  uploadMedicalDocuments,
  uploadStudentFile,
  type SaveStudentPhotosResult,
} from "@/features/students/lib/student-uploads";

const supabase = createClient();

const NO_PHOTO_CHANGES: SaveStudentPhotosResult = {
  failedUploads: 0,
  error: null,
};

export type EditStudentFormProps = {
  studentId: string;
  /** initialValues.photos כבר מכיל את הגלריה השמורה, לפי הסדר */
  initialValues: StudentFormValues;
  /**
   * כתובת הקו״ח הקיימת. ה-RPC כותב את payload.cv_url כפי שהוא, ולכן מי שלא
   * העלה קובץ חדש חייב לקבל בחזרה את הכתובת הישנה — אחרת העריכה הייתה
   * מוחקת את הקו״ח.
   */
  existingCvUrl: string | null;
  existingMedicalDocuments: string[];
  /** מדיניות האחסון מתירה העלאת קבצים לבעל הכרטיס בלבד */
  isCardOwner: boolean;
};

/**
 * האם הגלריה השתנתה מאז הטעינה. שמירה נעשית רק כשיש שינוי: אם טעינת
 * הגלריה בשרת נכשלה (והטופס קיבל רשימה ריקה), שמירת הכרטיס לא תמחק את
 * התמונות השמורות.
 */
function hasGalleryChanged(
  initial: readonly StudentPhotoItem[],
  current: readonly StudentPhotoItem[],
): boolean {
  if (initial.length !== current.length) return true;
  return current.some((item, index) => {
    const original = initial[index];
    return (
      item.kind !== "existing" ||
      original?.kind !== "existing" ||
      original.path !== item.path
    );
  });
}

function photoWarning(
  result: SaveStudentPhotosResult,
  isCardOwner: boolean,
): string | null {
  if (result.error) return `שמירת התמונות נכשלה: ${result.error}`;
  if (result.failedUploads === 0) return null;
  return isCardOwner
    ? `${result.failedUploads} תמונות לא הועלו. ניתן לנסות שוב מאוחר יותר.`
    : "העלאת תמונות זמינה לבעל הכרטיס. התמונות החדשות לא נשמרו, ושאר השינויים נשמרו.";
}

export default function EditStudentForm({
  studentId,
  initialValues,
  existingCvUrl,
  existingMedicalDocuments,
  isCardOwner,
}: EditStudentFormProps) {
  const router = useRouter();

  const handleSubmit: StudentFormWizardProps["onSubmit"] = async (values) => {
    try {
      const missingFields = missingRequiredStudentFields(values);
      if (missingFields.length > 0) {
        toast.error(
          `שגיאה: יש למלא את השדות החובה הבאים:\n${missingFields.join(", ")}`,
        );
        return;
      }

      if (!mapCellphoneType(values.cellphoneType)) {
        toast.error("שגיאה: יש לבחור סוג טלפון תקין עבור המיועד.ת");
        return;
      }

      // בשונה מהיצירה, ה-student_id כבר קיים — ולכן הקבצים מועלים לפני
      // הקריאה ל-RPC והכתובות נכנסות לעדכון עצמו, בלי סבב עדכון שני.
      const cvFile = values.cv?.file as File | null;

      const uploadedCvUrl = cvFile
        ? await uploadStudentFile(supabase, studentId, cvFile, "cv")
        : null;
      const uploadedMedicalDocuments = await uploadMedicalDocuments(
        supabase,
        studentId,
        values.medical?.documents ?? [],
      );

      const payload = buildStudentPayload(values, {
        cvUrl: uploadedCvUrl ?? existingCvUrl,
        // טבלת medical_records נמחקת ונכתבת מחדש ב-RPC, ולכן המסמכים
        // הקיימים חייבים להישלח שוב יחד עם החדשים.
        medicalDocuments: [
          ...existingMedicalDocuments,
          ...uploadedMedicalDocuments,
        ],
      });

      const { error: updateError } = await supabase.rpc(
        "update_full_student_profile",
        {
          p_student_id: studentId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: payload as any,
        },
      );

      if (updateError) {
        console.error("Failed updating student:", updateError);
        toast.error(`שגיאה בעדכון הקו״ח: ${updateError.message}`);
        return;
      }

      const photoResult = hasGalleryChanged(initialValues.photos, values.photos)
        ? await saveStudentPhotos(supabase, studentId, values.photos)
        : NO_PHOTO_CHANGES;

      const warning = photoWarning(photoResult, isCardOwner);
      if (warning) {
        toast.warning(`השינויים נשמרו. ${warning}`);
      } else if (Boolean(cvFile) && !uploadedCvUrl) {
        toast.warning(
          "השינויים נשמרו, אבל היו בעיות בהעלאת חלק מהקבצים. ניתן לנסות שוב מאוחר יותר.",
        );
      } else {
        toast.success("השינויים נשמרו בהצלחה!");
      }

      router.push(`/app/students/${studentId}`);
      router.refresh();
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("אירעה שגיאה לא צפויה");
    }
  };

  return (
    <StudentFormWizard
      heading="עריכת קו״ח"
      submitLabel="שמירת השינויים"
      submittingLabel="שומר..."
      initialValues={initialValues}
      onSubmit={handleSubmit}
    />
  );
}
