import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { getUser, hasRole } from "@/lib/user";

/**
 * מי רשאי להיכנס לפורום. אותו כלל שה-RLS אוכף ב-DB (is_approved_shadchan
 * או מנהל), כך שהמסך מסביר למה אין גישה במקום להציג רשימה ריקה.
 *   allowed      - שדכן מאושר או מנהל: קריאה, פרסום, תגובה ולייק.
 *                  isAdmin קובע רק אם להציג כפתור מחיקה לתוכן של אחרים;
 *                  המחיקה עצמה נאכפת ב-RLS (כותב התוכן או מנהל)
 *   pending      - יש תפקיד שדכן אך הבקשה טרם אושרה
 *   not_shadchan - הורה או משתמש אחר
 */
export type ForumAccess =
  | { status: "allowed"; userId: string; isAdmin: boolean }
  | { status: "pending" }
  | { status: "not_shadchan" };

export async function getForumAccess(): Promise<ForumAccess> {
  const user = await getUser();
  if (!user) return { status: "not_shadchan" };
  if (hasRole(user, "admin")) {
    return { status: "allowed", userId: user.id, isAdmin: true };
  }
  if (!hasRole(user, "shadchan")) return { status: "not_shadchan" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_approved_shadchan", {
    uid: user.id,
  });
  if (error) {
    console.error("[forums/access]", describeSupabaseError(error));
    return { status: "pending" };
  }

  return data === true
    ? { status: "allowed", userId: user.id, isAdmin: false }
    : { status: "pending" };
}
