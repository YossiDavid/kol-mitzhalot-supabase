import { unstable_noStore as noStore } from "next/cache";

import { redirectToStudentFile } from "@/features/students/lib/student-file-access";

/** GET: קו"ח של הכרטיס - הפניה לקישור חתום לכמה דקות, אחרי בדיקת הרשאה */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  noStore();
  const { studentId } = await params;
  return redirectToStudentFile(studentId, "cv");
}
