import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "@/features/announcements/lib/announcements";
import { recordActivity } from "@/features/admin/lib/record-activity";
import { broadcastShadchanAnnouncement } from "@/features/notifications/lib/send-shadchan-announcement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(user, "admin")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * POST: הודעת מערכת חדשה (באנר בכניסה). לשדכנים אפשר לצרף גם התראה בפעמון
 * ומייל - אותו שידור כמו "הודעה לכל השדכנים". מנהל בלבד.
 */
export async function POST(req: NextRequest) {
  noStore();
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = createAnnouncementSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "נא למלא כותרת ותוכן להודעה" }, { status: 400 });
  }
  const { title, body, audience, notifyShadchanim } = parsed.data;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_announcements")
      .insert({ title, body, audience, created_by: auth.user.id })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[admin/announcements] insert failed", error);
      return NextResponse.json({ error: "שמירת ההודעה נכשלה" }, { status: 500 });
    }

    const broadcast =
      notifyShadchanim && audience === "shadchanim"
        ? await broadcastShadchanAnnouncement(admin, { title, body })
        : null;

    await recordActivity(admin, {
      actorId: auth.user.id,
      action: "announcement.system",
      entityType: "announcement",
      entityId: data.id,
      summary: title,
      details: { audience, ...(broadcast ?? {}) },
    });

    return NextResponse.json({ success: true, id: data.id, broadcast });
  } catch (error) {
    console.error("[admin/announcements] unexpected error", error);
    return NextResponse.json({ error: "שמירת ההודעה נכשלה" }, { status: 500 });
  }
}

/** PATCH: הפעלה/הסתרה של הודעה (הודעה מוסתרת לא מוצגת בבאנר) */
export async function PATCH(req: NextRequest) {
  noStore();
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = updateAnnouncementSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("system_announcements")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[admin/announcements] update failed", error);
    return NextResponse.json({ error: "העדכון נכשל" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
