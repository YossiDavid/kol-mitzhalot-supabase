import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { parseDecisionBody } from "@/features/admin/lib/application-decision-body";
import {
  freezeBodySchema,
  MODERATION_NOTIFICATION,
} from "@/features/admin/lib/shadchan-moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

/**
 * הקפאת שדכן / ביטול הקפאה בידי מנהל. ההקפאה הפיכה: התפקיד נשאר, ורק
 * frozen_at משתנה - is_shadchan / is_approved_shadchan במסד ו-getShadchanAccess
 * באפליקציה מתייחסים לשדכן מוקפא כאל מי שאינו שדכן.
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

    const parsed = await parseDecisionBody(req, freezeBodySchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { userId, frozen, reason } = parsed.data;

    // רק מעבר אמיתי (מוקפא <-> פעיל) מחזיר שורה, וההתראה נשלחת רק אז.
    // RLS: מנהל מעדכן כל שורה; guard_shadchan_freeze מדלג עליו.
    const { data: changedRows, error } = await supabase
      .from("shadchanim_info")
      .update(
        frozen
          ? {
              frozen_at: new Date().toISOString(),
              frozen_by: currentUser.id,
              frozen_reason: reason ?? null,
            }
          : { frozen_at: null, frozen_by: null, frozen_reason: null },
      )
      .eq("user_id", userId)
      .filter("frozen_at", frozen ? "is" : "not.is", null)
      .select("user_id");

    if (error) {
      console.error("[admin/shadchanim/freeze] update failed:", error);
      return NextResponse.json(
        { error: "עדכון ההקפאה נכשל, נסו שוב" },
        { status: 500 },
      );
    }

    if (!changedRows || changedRows.length === 0) {
      const { data: row } = await supabase
        .from("shadchanim_info")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!row) {
        return NextResponse.json(
          { error: "לשדכן הזה אין פרופיל במערכת, ואי אפשר להקפיא אותו" },
          { status: 404 },
        );
      }
      // כבר במצב המבוקש (לחיצה כפולה): הצלחה בלי התראה נוספת
      return NextResponse.json({ success: true, changed: false });
    }

    const { error: notifyError } = await createAdminClient().rpc(
      "create_notification",
      {
        p_user_id: userId,
        p_type: MODERATION_NOTIFICATION.type,
        p_title: frozen
          ? MODERATION_NOTIFICATION.frozenTitle
          : MODERATION_NOTIFICATION.unfrozenTitle,
        p_body: frozen
          ? (reason ?? MODERATION_NOTIFICATION.frozenBody)
          : MODERATION_NOTIFICATION.unfrozenBody,
        p_link: MODERATION_NOTIFICATION.link,
      },
    );
    // ההקפאה כבר נשמרה; כשל בהתראה אינו מבטל אותה
    if (notifyError) {
      console.error(
        "[admin/shadchanim/freeze] notification failed:",
        notifyError,
      );
    }

    return NextResponse.json({ success: true, changed: true });
  } catch (error) {
    console.error("[admin/shadchanim/freeze] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
