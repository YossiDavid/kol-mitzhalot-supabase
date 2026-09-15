import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveViewablePhotoIds } from "@/features/students/lib/student-photo-access";
import {
  MAX_THUMBNAIL_BATCH,
  NO_STORE_HEADERS,
  type StudentThumbnail,
  type StudentThumbnailsResponse,
} from "@/features/students/lib/student-photo-api";
import { loadPrimaryPhotoUrls } from "@/features/students/lib/student-photos";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";

/**
 * התמונות הראשיות של שורות בטבלת המיועדים - בקשה אחת לכל טעינת רשימה.
 *
 * פרטיות:
 * - הכרטיסים נקראים בלקוח של המשתמש, כך ש-RLS קובע אילו כרטיסים בכלל
 *   קיימים עבורו; כרטיס שאינו חוזר אינו מופיע בתשובה.
 * - נתיבים נקראים ונחתמים (service role) רק לכרטיסים שעברו את
 *   can_view_student_photo. כרטיס נעול מקבל { status: "locked" } בלבד.
 * - הקישורים בתוקף SIGNED_PHOTO_URL_TTL_SECONDS ונוצרים מחדש בכל בקשה.
 */

const requestSchema = z.object({
  studentIds: z.array(z.guid()).min(1).max(MAX_THUMBNAIL_BATCH),
});

type StudentPhotoRow = {
  id: string;
  gender: string | null;
  photo_count: number | null;
};

function toThumbnail(
  student: StudentPhotoRow,
  viewableIds: ReadonlySet<string>,
  urls: ReadonlyMap<string, string>,
): StudentThumbnail {
  if ((student.photo_count ?? 0) <= 0) return { status: "none" };
  if (!viewableIds.has(student.id)) return { status: "locked" };
  const url = urls.get(student.id);
  return url ? { status: "ok", url } : { status: "none" };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("נדרשת התחברות", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("בקשה לא תקינה", 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("בקשה לא תקינה", 400);

  const studentIds = [...new Set(parsed.data.studentIds)];
  const { data, error } = await supabase
    .from("students")
    .select("id, gender, photo_count")
    .in("id", studentIds)
    .is("deleted_at", null);

  if (error) {
    console.error(
      "[students/thumbnails] students lookup failed",
      describeSupabaseError(error),
    );
    return errorResponse("שגיאה בטעינת התמונות", 500);
  }

  const students = (data ?? []) as StudentPhotoRow[];
  const withPhotos = students.filter(
    (student) => (student.photo_count ?? 0) > 0,
  );

  try {
    const viewableIds = await resolveViewablePhotoIds(
      supabase,
      user.id,
      withPhotos,
    );
    const urls = await loadPrimaryPhotoUrls([...viewableIds]);
    const response: StudentThumbnailsResponse = {
      thumbnails: Object.fromEntries(
        students.map((student) => [
          student.id,
          toThumbnail(student, viewableIds, urls),
        ]),
      ),
    };
    return NextResponse.json(response, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[students/thumbnails] failed", err);
    return errorResponse("שגיאה בטעינת התמונות", 500);
  }
}
