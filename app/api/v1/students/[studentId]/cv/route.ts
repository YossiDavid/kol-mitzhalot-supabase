import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateCvFile } from "@/features/students/lib/cv-file-rules";
import { STUDENT_PHOTOS_BUCKET } from "@/features/students/lib/student-photo-rules";
import {
  SIGNED_URL_TTL_SECONDS,
  buildStoragePath,
} from "@/features/students/lib/student-uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

/**
 * הוספת קו״ח לכרטיס מטבלת המיועדים.
 * הרשאה: כמו עריכת כרטיס (update_full_student_profile) - בעל הכרטיס, שדכן או
 * מנהל. מדיניות האחסון מתירה העלאה לבעל הכרטיס בלבד, ולכן הקובץ נשמר כאן
 * ב-service role, אחרי בדיקת ההרשאה.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.guid().safeParse(studentId).success) {
    return NextResponse.json({ error: "מזהה כרטיס לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id, user_id")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (studentError) {
    console.error("[students/cv] student lookup failed:", studentError);
    return NextResponse.json({ error: "שגיאה בטעינת הכרטיס" }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: "הכרטיס לא נמצא" }, { status: 404 });
  }

  const canEditCard =
    student.user_id === user.id ||
    hasRole(user, "shadchan") ||
    hasRole(user, "admin");
  if (!canEditCard) {
    return NextResponse.json(
      { error: "אין הרשאה להוסיף קו״ח לכרטיס הזה" },
      { status: 403 },
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "לא התקבל קובץ" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא התקבל קובץ" }, { status: 400 });
  }
  const fileError = validateCvFile(file);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const path = buildStoragePath(studentId, file, "cv");
  const storage = admin.storage.from(STUDENT_PHOTOS_BUCKET);

  const { error: uploadError } = await storage.upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) {
    console.error("[students/cv] upload failed:", uploadError);
    return NextResponse.json({ error: "העלאת הקובץ נכשלה" }, { status: 500 });
  }

  const { data: signed, error: signError } = await storage.createSignedUrl(
    path,
    SIGNED_URL_TTL_SECONDS,
  );
  if (signError || !signed) {
    console.error("[students/cv] signing failed:", signError);
    await storage.remove([path]);
    return NextResponse.json({ error: "העלאת הקובץ נכשלה" }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("students")
    .update({ cv_url: signed.signedUrl })
    .eq("id", studentId);
  if (updateError) {
    console.error("[students/cv] cv_url update failed:", updateError);
    // הקובץ לא נרשם בכרטיס - מנקים אותו כדי שלא יישאר יתום
    await storage.remove([path]);
    return NextResponse.json({ error: "שמירת הקובץ נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ cvUrl: signed.signedUrl });
}
