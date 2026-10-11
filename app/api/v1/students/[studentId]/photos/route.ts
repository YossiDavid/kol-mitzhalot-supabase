import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getStudentCardAccess } from "@/features/students/lib/student-card-access";
import { canViewStudentPhoto } from "@/features/students/lib/student-photo-access";
import {
  NO_STORE_HEADERS,
  type StudentGalleryResponse,
} from "@/features/students/lib/student-photo-api";
import { loadStudentPhotos } from "@/features/students/lib/student-photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";

/**
 * כל גלריית התמונות של כרטיס, חתומה - נטענת כשפותחים את ה-lightbox מטבלת
 * המיועדים. אותה הרשאה כמו בעמוד הכרטיס: הגישה לכרטיס נקבעת במסד
 * (get_student_card_access), והתמונה עצמה ב-can_view_student_photo. בלי הרשאה - 403 ואף קישור לא נחתם.
 * התשובה כוללת קישורים בלבד, לא נתיבים.
 */

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.guid().safeParse(studentId).success) {
    return errorResponse("מזהה כרטיס לא תקין", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("נדרשת התחברות", 401);

  // מי רשאי לראות את הכרטיס נקבע במסד (get_student_card_access): בעלים, שדכן,
  // מנהל, איש צוות, או מי שקיבל הצעה. מי שקיבל הצעה אינו קורא את שורת
  // students, ולכן המגדר נקרא ב-service role - רק אחרי שהגישה אושרה.
  const access = await getStudentCardAccess(supabase, studentId);
  if (access.level === "none") return errorResponse("הכרטיס לא נמצא", 404);

  const { data: student, error } = await createAdminClient()
    .from("students")
    .select("id, gender")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(
      "[students/gallery] student lookup failed",
      describeSupabaseError(error),
    );
    return errorResponse("שגיאה בטעינת התמונות", 500);
  }
  if (!student) return errorResponse("הכרטיס לא נמצא", 404);

  if (!(await canViewStudentPhoto(supabase, user.id, student))) {
    return errorResponse("אין הרשאה לצפות בתמונות של הכרטיס הזה", 403);
  }

  const { photos } = await loadStudentPhotos(student.id, { canView: true });
  const response: StudentGalleryResponse = {
    photos: photos.map(({ url }) => ({ url })),
  };
  return NextResponse.json(response, { headers: NO_STORE_HEADERS });
}
