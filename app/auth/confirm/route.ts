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
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") ? nextParam : "/app";

  // Log all incoming params for debugging
  console.log("[auth/confirm] params:", {
    token_hash: token_hash ? `${token_hash.substring(0, 8)}...` : null,
    type,
    code: code ? `${code.substring(0, 8)}...` : null,
    next,
    allKeys: [...searchParams.keys()],
  });

  // כש-Supabase מחזיר שגיאה (קישור שפג תוקף, access_denied וכו') – error, error_code, error_description
  const supabaseError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (supabaseError || errorDescription) {
    const msg =
      errorDescription ||
      supabaseError ||
      "הקישור לא תקף או שפג תוקפו. נא לבקש קישור חדש.";
    console.error("[auth/confirm] supabase error param:", msg);
    redirect(`/auth/error?error=${encodeURIComponent(msg)}`);
  }

  if (token_hash) {
    const supabase = await createClient();
    // כש-{{ .TokenType }} בתבנית המייל ריק – Supabase ב-PKCE לפעמים לא ממלא; magic link = magiclink
    const otpType = (type?.trim() || "magiclink") as EmailOtpType;
    console.log("[auth/confirm] calling verifyOtp, type:", otpType);
    const { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash });
    if (!error) {
      console.log("[auth/confirm] verifyOtp success, redirecting to:", next);
      redirect(next as never);
    }
    console.error("[auth/confirm] verifyOtp error:", error.message);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  // PKCE OAuth code exchange (used by some Supabase flows)
  if (code) {
    const supabase = await createClient();
    console.log("[auth/confirm] exchanging code for session");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log("[auth/confirm] exchangeCodeForSession success, redirecting to:", next);
      redirect(next as never);
    }
    console.error("[auth/confirm] exchangeCodeForSession error:", error.message);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  console.error("[auth/confirm] no token_hash or code in params. All params:", Object.fromEntries(searchParams));
  redirect(`/auth/error?error=${encodeURIComponent("חסרים פרמטרים לאימות. נא להשתמש בקישור מהמייל.")}`);
}
