"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { StudentFormValues } from "@/features/students/components/create-form/schema";
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
  uploadMedicalDocuments,
  uploadStudentFile,
} from "@/features/students/lib/student-uploads";

const supabase = createClient();

export type EditStudentFormProps = {
  studentId: string;
  initialValues: StudentFormValues;
  /**
   * הכתובות הקיימות. ה-RPC כותב את payload.image_url/cv_url כפי שהוא, ולכן
   * מי שלא העלה קובץ חדש חייב לקבל בחזרה את הכתובת הישנה — אחרת העריכה
   * הייתה מוחקת את התמונה והקו״ח.
   */
  existingImageUrl: string | null;
  existingCvUrl: string | null;
  existingMedicalDocuments: string[];
};

export default function EditStudentForm({
  studentId,
  initialValues,
  existingImageUrl,
  existingCvUrl,
  existingMedicalDocuments,
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
      const imageFile = values.image?.file as File | null;
      const cvFile = values.cv?.file as File | null;

      const uploadedImageUrl = imageFile
        ? await uploadStudentFile(supabase, studentId, imageFile, "image")
        : null;
      const uploadedCvUrl = cvFile
        ? await uploadStudentFile(supabase, studentId, cvFile, "cv")
        : null;
      const uploadedMedicalDocuments = await uploadMedicalDocuments(
        supabase,
        studentId,
        values.medical?.documents ?? [],
      );

      const hasUploadErrors =
        (Boolean(imageFile) && !uploadedImageUrl) ||
        (Boolean(cvFile) && !uploadedCvUrl);

      const payload = buildStudentPayload(values, {
        imageUrl: uploadedImageUrl ?? existingImageUrl,
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

      if (hasUploadErrors) {
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
