import { NextRequest, NextResponse, after } from "next/server";
import { sendApplicationDecisionEmail } from "@/features/notifications/lib/send-application-decision-email";
import {
  parseDecisionBody,
  rejectBodySchema,
} from "@/features/admin/lib/application-decision-body";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";

export async function POST(req: NextRequest) {
  noStore();

  try {
    const parsedBody = await parseDecisionBody(req, rejectBodySchema);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const { userId, reason } = parsedBody.data;

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

    // עדכון הסטטוס ב-shadchanim_info, רק לשורה שעדיין לא נדחתה; select מחזיר את
    // השורות שבאמת השתנו, והמייל נשלח רק במעבר סטטוס אמיתי.
    const { data: changedRows, error: dbError } = await supabase
      .from("shadchanim_info")
      .update({
        application_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_reason: reason || null,
      })
      .eq("user_id", userId)
      .or("application_status.is.null,application_status.neq.rejected")
      .select("user_id");

    if (dbError) {
      console.error("Error updating application status:", dbError);
      return NextResponse.json(
        { error: dbError.message || "Failed to reject application" },
        { status: 500 },
      );
    }

    // אחרי התגובה ובלי לזרוק
    if (changedRows && changedRows.length > 0) {
      after(() =>
        sendApplicationDecisionEmail({
          applicantId: userId,
          kind: "shadchan",
          decision: "rejected",
          reason: reason ?? null,
        }),
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application rejected successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error rejecting application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
