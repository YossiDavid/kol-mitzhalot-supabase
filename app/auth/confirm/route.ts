import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

export async function GET(request: NextRequest) {
  noStore();
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") ? nextParam : "/app";

  // כש-Supabase מחזיר שגיאה (קישור שפג תוקף, access_denied וכו') – error, error_code, error_description
  const supabaseError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (supabaseError || errorDescription) {
    const msg =
      errorDescription ||
      supabaseError ||
      "הקישור לא תקף או שפג תוקפו. נא לבקש קישור חדש.";
    redirect(`/auth/error?error=${encodeURIComponent(msg)}`);
  }

  if (token_hash) {
    const supabase = await createClient();
    // כש-{{ .TokenType }} בתבנית המייל ריק – Supabase ב-PKCE לפעמים לא ממלא; magic link = magiclink
    const otpType = (type?.trim() || "magiclink") as EmailOtpType;
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash });
    if (!error) {
      redirect(next as never);
    }
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/error?error=${encodeURIComponent("חסרים פרמטרים לאימות. נא להשתמש בקישור מהמייל.")}`);
}
