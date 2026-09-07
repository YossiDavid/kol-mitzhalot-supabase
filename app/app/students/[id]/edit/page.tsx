import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import {
  existingMedicalDocuments,
  studentToFormValues,
  type StudentRowWithRelations,
} from "@/features/students/lib/student-to-form";
import EditStudentForm from "./edit-student-form";

// אין כאן export const dynamic — הוא אסור תחת Cache Components (ראה ההערה
// בדף הכרטיס). noStore מספיק כדי שהטופס ייטען תמיד מהמצב העדכני.

function EditNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-3 text-center">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-body-sm text-muted-foreground">{body}</p>
        <Button asChild variant="outline">
          <Link href="/app/students">חזרה לרשימה</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <EditNotice
        title="נדרשת התחברות"
        body="כדי לערוך כרטיס יש להתחבר למערכת."
      />
    );
  }

  const { data, error } = await supabase
    .from("students")
    .select(
      `*,
		education_history(*),
		employment_history(*),
		medical_records(*),
		partner_preferences(*),
		references(*),
		previous_partners(*)
	`,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <EditNotice
        title="מיועד לא נמצא"
        body={error?.message ?? "הרשומה שחיפשת אינה קיימת במערכת"}
      />
    );
  }

  const student = data as StudentRowWithRelations;

  // בדיוק אותה הרשאה שה-RPC אוכף (בעלים / שדכן / מנהל), כדי שמסך שנפתח
  // לעולם לא ייפול על not_allowed בשמירה.
  const canEdit =
    student.user_id === user.id ||
    hasRole(user, "shadchan") ||
    hasRole(user, "admin");

  if (!canEdit) {
    return (
      <EditNotice
        title="אין לך הרשאה לערוך כרטיס זה"
        body="עריכת כרטיס פתוחה לבעל הכרטיס, לשדכנים ולמנהלים בלבד."
      />
    );
  }

  return (
    <EditStudentForm
      studentId={id}
      initialValues={studentToFormValues(student)}
      existingImageUrl={
        typeof student.image_url === "string" ? student.image_url : null
      }
      existingCvUrl={typeof student.cv_url === "string" ? student.cv_url : null}
      existingMedicalDocuments={existingMedicalDocuments(student)}
    />
  );
}
