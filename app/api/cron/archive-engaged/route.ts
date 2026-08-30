import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ארכוב אוטומטי של מאורסים.
 *
 * כרטיס שסטטוסו שונה ל"מאורס" מוצג חודש נוסף, ולאחר מכן עובר מחיקה רכה —
 * זהה למחיקה שמבצע מנהל מערכת (deleted_at נקבע, הנתונים נשמרים).
 *
 * מופעל ע"י Vercel Cron ב-GET, מאובטח ב-CRON_SECRET.
 * ראו https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 *
 * הפעולה אידמפוטנטית: שורות שכבר סומנו כמחוקות לא נבחרות שוב, ולכן ריצה
 * כפולה או ריצה שהוחמצה אינן משנות את התוצאה (דרישת התיעוד של Vercel).
 */

const ENGAGED_VISIBILITY_MONTHS = 1;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ENGAGED_VISIBILITY_MONTHS);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("students")
      .update({ deleted_at: new Date().toISOString(), deleted_by: null })
      .eq("personal_status", "engaged")
      .is("deleted_at", null)
      .lt("status_changed_at", cutoff.toISOString())
      .select("id");

    if (error) {
      console.error("[cron/archive-engaged] update failed:", error);
      return NextResponse.json(
        { error: "Failed to archive engaged students" },
        { status: 500 },
      );
    }

    const archived = data?.length ?? 0;
    console.log(
      `[cron/archive-engaged] archived ${archived} student(s) engaged before ${cutoff.toISOString()}`,
    );
    return NextResponse.json({ archived, cutoff: cutoff.toISOString() });
  } catch (err: unknown) {
    console.error("[cron/archive-engaged] unexpected failure:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
