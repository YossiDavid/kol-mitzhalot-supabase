"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
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

export default function CreateStudentPage() {
  const router = useRouter();

  const handleSubmit: StudentFormWizardProps["onSubmit"] = async (values) => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("User not authenticated", authError);
        toast.error("שגיאה: יש להתחבר למערכת");
        return;
      }

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

      // הכרטיס נוצר קודם ללא כתובות קבצים, כי נתיב האחסון נגזר מה-student_id
      // שנוצר רק כאן.
      const payload = buildStudentPayload(values, { userId: user.id });

      const { data: studentId, error: createError } = await supabase.rpc(
        "create_full_student_profile",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { payload: payload as any },
      );

      if (createError) {
        console.error("Failed creating student:", createError);
        toast.error(`שגיאה בשמירת הקו״ח: ${createError.message}`);
        return;
      }

      if (!studentId) {
        console.error(
          "No student ID returned from create_full_student_profile",
        );
        toast.error("שגיאה: לא התקבל מזהה סטודנט");
        return;
      }

      const imageFile = values.image?.file as File | null;
      const cvFile = values.cv?.file as File | null;

      const imageUrl = imageFile
        ? await uploadStudentFile(supabase, studentId, imageFile, "image")
        : null;
      const cvUrl = cvFile
        ? await uploadStudentFile(supabase, studentId, cvFile, "cv")
        : null;
      const medicalDocumentUrls = await uploadMedicalDocuments(
        supabase,
        studentId,
        values.medical?.documents ?? [],
      );

      const hasUploadErrors =
        (Boolean(imageFile) && !imageUrl) || (Boolean(cvFile) && !cvUrl);

      const fileUrls = {
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(cvUrl ? { cv_url: cvUrl } : {}),
      };

      if (Object.keys(fileUrls).length > 0) {
        const { error: updateError } = await supabase
          .from("students")
          .update(fileUrls)
          .eq("id", studentId);

        if (updateError) {
          console.error("Error updating student with file URLs:", updateError);
          toast.error(
            "הקו״ח נוצר בהצלחה, אבל הייתה בעיה בעדכון כתובות הקבצים. אנא עדכן ידנית.",
          );
        }
      }

      // רשומת ה-medical_records כבר נוצרה ב-RPC; רק המסמכים חסרים בה כי הם
      // הועלו אחריה.
      if (medicalDocumentUrls.length > 0) {
        const { error: medicalUpdateError } = await supabase
          .from("medical_records")
          .update({ documents: medicalDocumentUrls })
          .eq("student_id", studentId);

        if (medicalUpdateError) {
          console.error(
            "Error updating medical records with documents:",
            medicalUpdateError,
          );
          toast.error(
            `הקו״ח נשמר, אבל הייתה בעיה בעדכון מסמכים רפואיים: ${medicalUpdateError.message}`,
          );
        }
      }

      if (hasUploadErrors) {
        toast.warning(
          "הקו״ח נשמר בהצלחה, אבל היו בעיות בהעלאת חלק מהקבצים. ניתן לעדכן את הקבצים מאוחר יותר.",
        );
      } else {
        toast.success("הקו״ח נשמר בהצלחה!");
      }

      router.push(`/app/students/${studentId}`);
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("אירעה שגיאה לא צפויה");
    }
  };

  return (
    <StudentFormWizard
      heading="הוספת קו״ח למערכת"
      submitLabel="שליחה למערכת"
      submittingLabel="שומר..."
      onSubmit={handleSubmit}
    />
  );
}
