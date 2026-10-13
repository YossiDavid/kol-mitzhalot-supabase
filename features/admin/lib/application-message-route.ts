import { NextResponse, after } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { sendApplicationMessageEmail } from "@/features/notifications/lib/send-application-message-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationKind } from "@/lib/email/templates/application-decision";
import { hasRole } from "@/lib/user";

import {
  messageBodySchema,
  parseDecisionBody,
} from "./application-decision-body";
import { recordApplicationMessage } from "./record-application-message";

/** תקרת הודעות למבקש ביממה (מנהלים בלבד, מגן מפני לחיצות כפולות ולולאות) */
export const APPLICATION_MESSAGES_PER_DAY_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const REQUEST_TABLE: Record<ApplicationKind, string> = {
  shadchan: "shadchanim_info",
  staff: "staff_info",
};

const ERROR = {
  invalid: "ההודעה אינה תקינה (ריקה או ארוכה מדי)",
  notFound: "הבקשה לא נמצאה",
  rateLimited: "נשלחו יותר מדי הודעות למבקש/ת זה/זו היום. נסו שוב מחר",
  failed: "שליחת ההודעה נכשלה, נסו שוב",
} as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * POST משותף ל-route-ים של שליחת הודעה למבקש (שדכן/איש צוות). מנהל בלבד;
 * המבקש נפתר בשרת משורת הבקשה לפי userId, והמייל נשלח לכתובת שלו מ-auth.
 */
export async function handleApplicationMessagePost(
  req: Request,
  kind: ApplicationKind,
): Promise<NextResponse> {
  noStore();
  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return fail("Unauthorized", 401);
    if (!hasRole(currentUser, "admin")) return fail("Forbidden", 403);

    const parsedBody = await parseDecisionBody(req, messageBodySchema);
    if (!parsedBody.ok) return fail(ERROR.invalid, 400);
    const { userId, message } = parsedBody.data;

    const admin = createAdminClient();

    const { data: requestRow, error: lookupError } = await admin
      .from(REQUEST_TABLE[kind])
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) {
      console.error("[application-message] בדיקת הבקשה נכשלה", lookupError);
      return fail(ERROR.failed, 500);
    }
    if (!requestRow) return fail(ERROR.notFound, 404);

    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { count, error: countError } = await admin
      .from("application_messages")
      .select("id", { count: "exact", head: true })
      .eq("applicant_user_id", userId)
      .gte("created_at", since);
    if (countError) {
      console.error("[application-message] בדיקת תקרה נכשלה", countError);
      return fail(ERROR.failed, 500);
    }
    if ((count ?? 0) >= APPLICATION_MESSAGES_PER_DAY_LIMIT) {
      return fail(ERROR.rateLimited, 429);
    }

    const recorded = await recordApplicationMessage(admin, {
      kind,
      applicantId: userId,
      adminId: currentUser.id,
      message,
    });
    if (!recorded.ok) return fail(ERROR.failed, 500);

    // אחרי התגובה ובלי לזרוק: כשל במייל אינו מכשיל את השליחה
    after(() =>
      sendApplicationMessageEmail({ applicantId: userId, kind, message }),
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[application-message] שגיאה לא צפויה", error);
    return fail(ERROR.failed, 500);
  }
}
