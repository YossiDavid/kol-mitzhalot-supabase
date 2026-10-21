import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { parseDecisionBody } from "@/features/admin/lib/application-decision-body";
import { recordActivity } from "@/features/admin/lib/record-activity";
import { announcementBodySchema } from "@/features/admin/lib/shadchan-announcement";
import { broadcastShadchanAnnouncement } from "@/features/notifications/lib/send-shadchan-announcement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

/**
 * הודעת הנהלה לכל השדכנים המאושרים שאינם מוקפאים: התראה בפעמון ומייל.
 * מנהל בלבד. מחזיר את מספר הנמענים והמיילים, ונרשם ביומן הפעילות.
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

    const parsed = await parseDecisionBody(req, announcementBodySchema);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "נא למלא כותרת ותוכן להודעה" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const result = await broadcastShadchanAnnouncement(admin, parsed.data);

    await recordActivity(admin, {
      actorId: currentUser.id,
      action: "announcement.shadchanim",
      entityType: "announcement",
      entityId: null,
      summary: parsed.data.title,
      details: { ...result },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[admin/shadchanim/announce] unexpected error:", error);
    return NextResponse.json(
      { error: "שליחת ההודעה נכשלה, נסו שוב" },
      { status: 500 },
    );
  }
}
