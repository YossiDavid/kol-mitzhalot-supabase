"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { accountFullName } from "@/features/students/lib/account-full-name";
import { createClient } from "@/lib/supabase/client";
import {
  StudentFormWizard,
  type LateAuthorDefaults,
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
} from "@/features/students/lib/student-uploads";
import { createStudentProfile } from "@/features/students/lib/save-student-profile";

const supabase = createClient();

export default function CreateStudentPage() {
  const router = useRouter();
  // האימייל והשם מגיעים אחרי שהטופס כבר מוצג (הטופס אינו ממתין להם); אם
  // הטעינה נכשלה או שאין ערך - השדה פשוט נשאר ריק וחובה
  const [authorDefaults, setAuthorDefaults] = useState<LateAuthorDefaults>({
    email: null,
    name: null,
  });

  useEffect(() => {
    let isCancelled = false;
    // getSession קורא את ה-session המקומי בלי סבב רשת, כך שהאימייל מתמלא
    // כמעט מיד אחרי העלייה (לפני שהמשתמש מספיק לעבור שלב). זה רק מילוי
    // מראש של שדה ניתן לעריכה - לא החלטת הרשאה
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const sessionUser = data.session?.user;
        if (isCancelled || !sessionUser) return;
        setAuthorDefaults({
          email: sessionUser.email ?? null,
          name: accountFullName(sessionUser),
        });
      })
      .catch((error: unknown) => {
        console.error("Loading account details for card form failed:", error);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

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

      // הכרטיס נוצר קודם ללא כתובות קבצים, כי נתיב האחסון נגזר מה-student_id
      // שנוצר רק כאן.
      const payload = buildStudentPayload(values);

      const { data: studentId, error: createError } =
        await createStudentProfile(payload);

      if (createError) {
        console.error("Failed creating student:", createError);
        toast.error(`שגיאה בשמירת הקו״ח: ${createError.message}`);
        return;
      }

      if (!studentId) {
        console.error(
          "No student ID returned from create_full_student_profile",
        );
        toast.error("שגיאה: לא התקבל מזהה כרטיס");
        return;
      }

      const cvFile = values.cv?.file as File | null;

      const photoResult =
        values.photos.length > 0
          ? await saveStudentPhotos(supabase, studentId, values.photos)
          : { failedUploads: 0, error: null };
      const cvUrl = cvFile
        ? await uploadStudentFile(supabase, studentId, cvFile, "cv")
        : null;
      const medicalDocumentUrls = await uploadMedicalDocuments(
        supabase,
        studentId,
        values.medical?.documents ?? [],
      );

      if (photoResult.error) {
        console.error("Failed saving student photos:", photoResult.error);
        toast.error("הקו״ח נשמר, אבל שמירת התמונות נכשלה");
      }

      const hasUploadErrors =
        photoResult.failedUploads > 0 || (Boolean(cvFile) && !cvUrl);

      if (cvUrl) {
        const { error: updateError } = await supabase
          .from("students")
          .update({ cv_url: cvUrl })
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
          toast.error("הקו״ח נשמר, אבל הייתה בעיה בעדכון מסמכים רפואיים");
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
      lateAuthorDefaults={authorDefaults}
      heading="הוספת קו״ח למערכת"
      submitLabel="שליחה למערכת"
      submittingLabel="שומר..."
      onSubmit={handleSubmit}
    />
  );
}
