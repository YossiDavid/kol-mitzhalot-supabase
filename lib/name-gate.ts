import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hasRequiredFullName } from "@/lib/user-display-name";
import { resolveUserPhone } from "@/lib/phone";
import {
  DEFAULT_NEXT_PATH,
  sanitizeNextPath,
} from "@/features/auth/lib/next-path";

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

/** מה ש-getClaims מחזיר ויש בו שדות זיהוי (JWT חתום, לא קריאה לשרת) */
export type IdentityClaims = {
  sub?: string;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * מסלול מהיר: אם כבר ה-claims החתומים מראים שם פרטי, שם משפחה וטלפון, אין
 * צורך בקריאת getUser לשרת האימות ובשאילתת user_profiles. חסר משהו ב-claims
 * (שהם עד שעה מאחור) - ממשיכים למסלול המלא, שהוא המקור העדכני. הבדיקה הזו
 * רק מוותרת על הפניה מיותרת; היא אינה מעניקה הרשאה לשום דבר.
 */
function isIdentityCompleteInClaims(claims: IdentityClaims | null | undefined) {
  if (!claims?.sub) return false;
  // רק השדות שהבדיקה קוראת (user_metadata, phone) - בלי שאר שדות ה-User
  const claimsAsUser = {
    user_metadata: claims.user_metadata ?? {},
    phone: claims.phone ?? undefined,
  } as User;
  return findMissingIdentityField(claimsAsUser) === null;
}

/**
 * משתמש מחובר באזור /app חייב שם פרטי, שם משפחה וטלפון
 * (מטא־דאטה או user_profiles). מחריגים את דף ההגדרות שבו ממלאים אותם.
 */
export async function checkNameRequirement(
  request: NextRequest,
  supabase: SupabaseClient,
  claims?: IdentityClaims | null,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/app")) return null;
  if (pathname === "/app/settings" || pathname.startsWith("/app/settings/")) {
    return null;
  }

  if (isIdentityCompleteInClaims(claims)) return null;

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

  // היעד המקורי נשמר כדי שהורה חדש שהגיע מקישור להצעת שידוך יוחזר אליה
  // אחרי השלמת הפרטים, ולא ייתקע בדף ההגדרות.
  const requestedPath = `${pathname}${request.nextUrl.search}`;

  const url = request.nextUrl.clone();
  url.pathname = "/app/settings";
  url.search = "";
  url.searchParams.set("required", missing);
  if (sanitizeNextPath(requestedPath) !== DEFAULT_NEXT_PATH) {
    url.searchParams.set("next", requestedPath);
  }
  return NextResponse.redirect(url);
}
