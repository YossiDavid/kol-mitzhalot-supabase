import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendDisclosureOpenedEmail } from "@/features/notifications/lib/send-disclosure-opened-email";
import {
  disclosureFlagsSchema,
  disclosureResultSchema,
} from "@/features/shidduchim/lib/proposal-disclosure";
import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

const idSchema = z.guid();

/**
 * מחיקת הצעת שידוך על ידי השדכן שיצר אותה.
 *
 * במכוון עם לקוח המשתמש ולא עם service role: מדיניות ה-RLS
 * "Users can delete their own shidduchim" (auth.uid() = shadchan_id) היא
 * שאוכפת מי רשאי, ולא בדיקה בקוד שאפשר לשכוח. לכן גם מנהל אינו מוחק
 * הצעה של שדכן אחר.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "מזהה לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "יש להתחבר מחדש" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("shidduchim")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[shidduchim/delete]", describeSupabaseError(error));
    return NextResponse.json({ error: "מחיקת ההצעה נכשלה" }, { status: 500 });
  }

  // אפס שורות = ההצעה לא קיימת או שאינה של המשתמש. לא מבחינים ביניהם,
  // כדי לא לחשוף לזר שהצעה כזו קיימת.
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "ההצעה לא נמצאה, או שאינה שלך" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

const DISCLOSURE_ERRORS: Record<string, { error: string; status: number }> = {
  not_allowed: { error: "רק השדכן של ההצעה או מנהל רשאים לשנות", status: 403 },
  not_found: { error: "ההצעה לא נמצאה", status: 404 },
  authentication_required: { error: "יש להתחבר מחדש", status: 401 },
};

/**
 * מה הצדדים רואים בכרטיס של הצד השני: קו״ח, פרטי ממליצים, הצהרה רפואית,
 * תמונת הבחור. ההרשאה (השדכן של ההצעה או מנהל), השמירה וההתראות בפעמון -
 * ב-public.set_proposal_disclosure, בסשן של המשתמש. כאן נשלח רק המייל, למי
 * שהמסד החזיר שקיבל התראה חדשה.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "מזהה לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "יש להתחבר מחדש" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const parsed = disclosureFlagsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const flags = parsed.data;

  const { data, error } = await supabase.rpc("set_proposal_disclosure", {
    p_shidduch_id: id,
    p_share_cv: flags.shareCv,
    p_share_references: flags.shareReferences,
    p_share_medical: flags.shareMedical,
    p_share_groom_photo: flags.shareGroomPhoto,
  });
  if (error) {
    const known = DISCLOSURE_ERRORS[error.message];
    if (known) {
      return NextResponse.json(
        { error: known.error },
        { status: known.status },
      );
    }
    console.error("[shidduchim/disclosure]", describeSupabaseError(error));
    return NextResponse.json({ error: "השמירה נכשלה" }, { status: 500 });
  }

  const result = disclosureResultSchema.safeParse(data);
  if (!result.success) {
    console.error(
      "[shidduchim/disclosure] unexpected result",
      result.error.issues,
    );
    return NextResponse.json({ ok: true, notified: 0 });
  }
  await Promise.all(
    result.data.notified.map((entry) =>
      sendDisclosureOpenedEmail({
        ownerId: entry.user_id,
        otherStudentId: entry.other_student_id,
        items: entry.items,
      }),
    ),
  );
  return NextResponse.json({ ok: true, notified: result.data.notified.length });
}
