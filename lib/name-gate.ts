import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hasRequiredFullName } from "@/lib/user-display-name";
import { resolveUserPhone } from "@/lib/phone";

/** מה חסר למשתמש כדי לעמוד בדרישות הזיהוי */
export type MissingIdentityField = "name" | "phone";

type ProfileNames = {
  first_name: string | null;
  last_name: string | null;
} | null;

/**
 * שדות זיהוי חובה: שם פרטי, שם משפחה וטלפון.
 * מחזיר את השדה החסר הראשון, או null אם המשתמש שלם.
 */
export function findMissingIdentityField(
  user: User,
  profile?: ProfileNames,
): MissingIdentityField | null {
  if (!hasRequiredFullName(user, profile)) return "name";
  if (!resolveUserPhone(user)) return "phone";
  return null;
}

/**
 * משתמש מחובר באזור /app חייב שם פרטי, שם משפחה וטלפון
 * (מטא־דאטה או user_profiles). מחריגים את דף ההגדרות שבו ממלאים אותם.
 */
export async function checkNameRequirement(
  request: NextRequest,
  supabase: SupabaseClient,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/app")) return null;
  if (pathname === "/app/settings" || pathname.startsWith("/app/settings/")) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const missing = findMissingIdentityField(user, profile);
  if (!missing) return null;

  const url = request.nextUrl.clone();
  url.pathname = "/app/settings";
  url.searchParams.set("required", missing);
  return NextResponse.redirect(url);
}
