/**
 * Supabase Session Manager (Edge middleware)
 *
 * מרענן סשן (getClaims) ואופציונלית מפנה ל-/app/settings אם חסרים שם פרטי ומשפחה.
 * מעדכן גם "נראה לאחרונה" (user_profiles.last_seen_at) - לכל היותר פעם
 * ב-LAST_SEEN_THROTTLE_SECONDS למשתמש, לפי עוגיית throttle.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNameRequirement } from "@/lib/name-gate";
import { IMPERSONATION_TARGET_COOKIE } from "@/lib/impersonation";

/** עוגיית ה-throttle של "נראה לאחרונה": ערכה מזהה המשתמש שעודכן */
const LAST_SEEN_COOKIE = "km_last_seen";
/** בתדירות הזו לכל היותר נכתב last_seen_at לכל משתמש */
const LAST_SEEN_THROTTLE_SECONDS = 5 * 60;

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * קריאת RPC זולה אחת (touch_last_seen מעדכנת רק את השורה של המשתמש) ורק כשאין
 * עוגיית throttle בתוקף לאותו משתמש. ה-await מכוון: fire-and-forget אינו
 * אמין ב-proxy (הבקשה עלולה להיחתך לפני שהכתיבה יצאה). כשל אינו חוסם את
 * הבקשה - נרשם, והעוגייה לא נקבעת, כך שינוסה שוב בבקשה הבאה.
 */
async function touchLastSeen(
  request: NextRequest,
  supabase: SupabaseClient,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) return false;
  if (request.cookies.get(LAST_SEEN_COOKIE)?.value === userId) return false;
  // מנהל שמתחזה למשתמש: זו לא פעילות של המשתמש עצמו
  if (request.cookies.get(IMPERSONATION_TARGET_COOKIE)?.value === userId) {
    return false;
  }

  const { error } = await supabase.rpc("touch_last_seen");
  if (error) {
    console.error("[proxy] touch_last_seen failed", error.message);
    return false;
  }
  return true;
}

function setLastSeenCookie(response: NextResponse, userId: string) {
  response.cookies.set(LAST_SEEN_COOKIE, userId, {
    maxAge: LAST_SEEN_THROTTLE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export type MiddlewareOptions = {
  /** דורש שם פרטי + משפחה בכל /app למעט /app/settings */
  checkName?: boolean;
};

export async function runMiddlewareSession(
  request: NextRequest,
  options: MiddlewareOptions = {},
): Promise<NextResponse> {
  const { checkName = false } = options;

  // מעבירים את הנתיב הנוכחי הלאה כ-header (x-pathname) כדי ש-Server
  // Components (כמו app/app/layout.tsx) יוכלו לדעת על איזה נתיב מדובר -
  // ל-layout אין גישה ישירה ל-pathname, ואנחנו זקוקים לזה כדי לאפשר גישה
  // לכרטיס מיועד גם למשתמש לא מחובר.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  // ה-query נשמר בנפרד מהנתיב: הנתיב לבדו משמש להתאמות regex (כרטיס מיועד
  // ציבורי), ושניהם יחד מרכיבים את יעד ההפניה שנשמר כשמשתמש לא מחובר נשלח
  // להתחברות.
  requestHeaders.set("x-search", request.nextUrl.search);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // חייבים לבנות מחדש את ה-header גם כאן - NextResponse.next החדש
          // מאפס את הבקשה המועברת הלאה, כך שבלי זה x-pathname היה אובד בכל
          // פעם שהעוגיות מתרעננות (setAll נקרא).
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options: opts }) =>
            supabaseResponse.cookies.set(name, value, opts),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : undefined;
  const isLastSeenTouched = await touchLastSeen(request, supabase, userId);

  if (checkName) {
    const redirect = await checkNameRequirement(
      request,
      supabase,
      claimsData?.claims,
    );
    if (redirect) {
      copyCookies(supabaseResponse, redirect);
      if (isLastSeenTouched && userId) setLastSeenCookie(redirect, userId);
      return redirect;
    }
  }

  if (isLastSeenTouched && userId) setLastSeenCookie(supabaseResponse, userId);
  return supabaseResponse;
}

/** תאימות לאחור — רק רענון סשן */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  return runMiddlewareSession(request, { checkName: false });
}
