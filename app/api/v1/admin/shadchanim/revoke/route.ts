import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { parseDecisionBody } from "@/features/admin/lib/application-decision-body";
import {
  MODERATION_NOTIFICATION,
  revokeBodySchema,
} from "@/features/admin/lib/shadchan-moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { updateUserRoles } from "@/lib/supabase/user-roles";
import { hasRole } from "@/lib/user";

/**
 * הסרת הרשאות שדכן בידי מנהל: מסיר את התפקיד shadchan (שאר התפקידים נשארים)
 * ומסמן את הבקשה כנדחתה עם הסיבה. השורה ב-shadchanim_info נשמרת (היסטוריה,
 * הצעות קיימות), וההקפאה - אם הייתה - מתבטלת, כי אין יותר מה להקפיא. המשתמש
 * יכול להגיש בקשה חדשה כמו אחרי דחייה.
 */
export async function POST(req: NextRequest) {
  noStore();

  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(currentUser, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseDecisionBody(req, revokeBodySchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { userId, reason } = parsed.data;

    const admin = createAdminClient();
    const roleUpdate = await updateUserRoles(admin, userId, (existing) =>
      existing.filter((role) => role !== "shadchan"),
    );
    if (!roleUpdate.ok) {
      console.error("[admin/shadchanim/revoke] roles:", roleUpdate.message);
      return NextResponse.json(
        {
          error:
            roleUpdate.status === 404
              ? "המשתמש לא נמצא"
              : "הסרת ההרשאות נכשלה, נסו שוב",
        },
        { status: roleUpdate.status },
      );
    }

    // מעבר approved -> rejected מפעיל את notify_application_reviewed, שמנסחת
    // "הרשאות השדכן שלך הוסרו" עם הסיבה
    const { data: changedRows, error } = await supabase
      .from("shadchanim_info")
      .update({
        application_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_reason: reason,
        frozen_at: null,
        frozen_by: null,
        frozen_reason: null,
      })
      .eq("user_id", userId)
      .select("user_id");

    if (error) {
      // התפקיד כבר הוסר - זה העיקר; הסטטוס יתעדכן בניסיון חוזר
      console.error("[admin/shadchanim/revoke] status update failed:", error);
      return NextResponse.json(
        { error: "ההרשאות הוסרו, אבל עדכון סטטוס הבקשה נכשל. נסו שוב" },
        { status: 500 },
      );
    }

    // שדכן בלי שורת בקשה (תפקיד שהוגדר ידנית): אין טריגר, ולכן התראה ישירה
    if (!changedRows || changedRows.length === 0) {
      const { error: notifyError } = await admin.rpc("create_notification", {
        p_user_id: userId,
        p_type: MODERATION_NOTIFICATION.type,
        p_title: MODERATION_NOTIFICATION.revokedTitle,
        p_body: reason,
        p_link: MODERATION_NOTIFICATION.link,
      });
      if (notifyError) {
        console.error("[admin/shadchanim/revoke] notification:", notifyError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/shadchanim/revoke] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
