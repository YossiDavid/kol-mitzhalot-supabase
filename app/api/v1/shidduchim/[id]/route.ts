import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
