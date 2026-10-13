import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  formToColumns,
  shadchanProfileSchema,
} from "@/features/shadchanim/lib/profile-form";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

/** גוף הבקשה: מזהה השדכן + אותם שדות וחוקים כמו בטופס */
const updateProfileBodySchema = shadchanProfileSchema.extend({
  userId: z.guid(),
});

/**
 * עריכת פרופיל שדכן בידי מנהל. מעדכן עמודות פרופיל בלבד - לעולם לא את
 * הסטטוס, תאריכי ההגשה/אישור/דחייה (אלה נשארים בנתיבי האישור והדחייה).
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

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = updateProfileBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { userId, ...formData } = parsed.data;

    // RLS: המנהל רשאי לעדכן כל שורה; הטריגר מדלג עליו, ולכן העמודות מוגבלות כאן
    const { data: updated, error } = await supabase
      .from("shadchanim_info")
      .update(formToColumns(formData))
      .eq("user_id", userId)
      .select("user_id");

    if (error) {
      console.error("Error updating shadchan profile:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error updating shadchan profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
