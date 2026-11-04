import { NextResponse } from "next/server";
import { z } from "zod";

import { STUDENT_PHOTOS_BUCKET } from "@/features/students/lib/student-photo-rules";
import {
  isPathOfStudent,
  toStudentStoragePath,
  type StudentFileKind,
} from "@/features/students/lib/student-files";
import { STUDENT_CARDS_VIEW } from "@/features/students/lib/third-party-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** תוקף הקישור החתום: מספיק לפתיחת הקובץ, ולא יותר */
const FILE_LINK_TTL_SECONDS = 5 * 60;

type UserClient = Awaited<ReturnType<typeof createClient>>;

/**
 * הערך שהצופה רשאי לקבל, דרך אותם נתיבי קריאה שמזינים את הכרטיס - כך
 * ההרשאה זהה בדיוק למה שהכרטיס מציג:
 * - קו"ח: ה-view (בעלים / שדכן / מנהל / צוות), ואחרת כרטיס ההצעה (share_cv)
 * - מסמך רפואי: get_student_medical_record (בעלים / מנהל / שדכן לפי רמת
 *   החשיפה), ואחרת כרטיס ההצעה (share_medical)
 */
async function readAllowedValue(
  supabase: UserClient,
  studentId: string,
  kind: StudentFileKind,
  index: number,
): Promise<unknown> {
  if (kind === "cv") {
    const { data } = await supabase
      .from(STUDENT_CARDS_VIEW)
      .select("cv_url")
      .eq("id", studentId)
      .maybeSingle();
    if (data?.cv_url) return data.cv_url;
    const proposal = await supabase.rpc("get_proposal_student_card", {
      p_student_id: studentId,
    });
    return (proposal.data as { cv_url?: unknown } | null)?.cv_url;
  }

  const medical = await supabase.rpc("get_student_medical_record", {
    p_student_id: studentId,
  });
  let documents = (medical.data as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(documents)) {
    const proposal = await supabase.rpc("get_proposal_student_card", {
      p_student_id: studentId,
    });
    const record = (
      proposal.data as { medical_records?: { documents?: unknown } } | null
    )?.medical_records;
    documents = record?.documents;
  }
  return Array.isArray(documents) ? documents[index] : null;
}

/**
 * מפנה לקישור חתום לכמה דקות לקובץ של הכרטיס, אחרי בדיקת הרשאה. כל כשל
 * (לא מחובר, אין הרשאה, אין קובץ) מחזיר 404 - בלי לחשוף אם הקובץ קיים.
 */
export async function redirectToStudentFile(
  studentId: string,
  kind: StudentFileKind,
  index = 0,
): Promise<NextResponse> {
  const notFound = NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  if (!z.guid().safeParse(studentId).success) return notFound;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const value = await readAllowedValue(supabase, studentId, kind, index);
  const path = toStudentStoragePath(value);
  if (!path || !isPathOfStudent(path, studentId)) return notFound;

  const { data, error } = await createAdminClient()
    .storage.from(STUDENT_PHOTOS_BUCKET)
    .createSignedUrl(path, FILE_LINK_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[students/files] sign failed:", kind, error);
    return notFound;
  }

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
