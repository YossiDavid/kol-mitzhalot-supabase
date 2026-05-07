import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hasRequiredFullName } from "@/lib/user-display-name";

/**
 * משתמש מחובר באזור /app חייב שם פרטי ושם משפחה (מטא־דאטה או user_profiles).
 * מחריגים את דף ההגדרות שבו ממלאים את השמות.
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

  if (hasRequiredFullName(user, profile)) return null;

  const url = request.nextUrl.clone();
  url.pathname = "/app/settings";
  url.searchParams.set("required", "name");
  return NextResponse.redirect(url);
}
