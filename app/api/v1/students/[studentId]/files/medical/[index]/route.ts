import { unstable_noStore as noStore } from "next/cache";

import { redirectToStudentFile } from "@/features/students/lib/student-file-access";

const MAX_DOCUMENT_INDEX = 50;

/** GET: מסמך רפואי (לפי מיקומו ברשימה) - הפניה לקישור חתום לכמה דקות */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string; index: string }> },
) {
  noStore();
  const { studentId, index } = await params;
  const position = Number(index);
  if (!Number.isInteger(position) || position < 0 || position > MAX_DOCUMENT_INDEX) {
    return Response.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }
  return redirectToStudentFile(studentId, "medical", position);
}
