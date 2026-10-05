import { NextRequest, NextResponse, after } from "next/server";
import { sendApplicationDecisionEmail } from "@/features/notifications/lib/send-application-decision-email";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveBodySchema,
  parseDecisionBody,
} from "@/features/admin/lib/application-decision-body";
import { createClient } from "@/lib/supabase/server";
import { hasRole, primaryRole } from "@/lib/user";
import { updateUserRoles } from "@/lib/supabase/user-roles";
import { unstable_noStore as noStore } from "next/cache";

export async function POST(req: NextRequest) {
  noStore();

  try {
    const parsedBody = await parseDecisionBody(req, approveBodySchema);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const { userId } = parsedBody.data;

    // Verify the requesting user is authenticated and is an admin
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = hasRole(currentUser, "admin");
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // התפקידים יושבים ב-app_metadata.roles (לא ב-user_metadata, שהמשתמש עצמו
    // יכול לכתוב). מוסיפים shadchan לרשימה הקיימת בלי לדרוס אותה - דריסה היא
    // הבאג שהוריד למשתמש אמיתי (hello@shos.digital) את הרשאות השדכן שלו כשאושר
    // בנפרד כאיש צוות.
    const roleUpdate = await updateUserRoles(adminClient, userId, (existing) => [
      ...existing,
      "shadchan",
    ]);

    if (!roleUpdate.ok) {
      console.error("Error updating user role:", roleUpdate.message);
      return NextResponse.json(
        { error: roleUpdate.message },
        { status: roleUpdate.status },
      );
    }
    const updatedUser = roleUpdate.user;

    // עדכון הסטטוס ב-shadchanim_info. מעדכנים רק שורה שעדיין לא מאושרת, ו-select
    // מחזיר את השורות שבאמת השתנו: כך המייל נשלח רק במעבר סטטוס אמיתי
    // (לא בלחיצה חוזרת ולא כשאף שורה לא עודכנה).
    const { data: changedRows, error: dbError } = await supabase
      .from("shadchanim_info")
      .update({
        application_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .or("application_status.is.null,application_status.neq.approved")
      .select("user_id");

    if (dbError) {
      console.error("Error updating application status:", dbError);
      // לא נחזיר שגיאה כאן כי התפקיד כבר עודכן
      // אבל נדווח על זה
    } else if (changedRows && changedRows.length > 0) {
      // אחרי התגובה ובלי לזרוק: כשל במייל אינו מכשיל את האישור.
      after(() =>
        sendApplicationDecisionEmail({
          applicantId: userId,
          kind: "shadchan",
          decision: "approved",
        }),
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application approved successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: primaryRole(updatedUser),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error approving application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
