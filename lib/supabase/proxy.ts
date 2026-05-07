/**
 * Supabase Session Manager (Edge middleware)
 *
 * מרענן סשן (getClaims) ואופציונלית מפנה ל-/app/settings אם חסרים שם פרטי ומשפחה.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkNameRequirement } from "@/lib/name-gate";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
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

  let supabaseResponse = NextResponse.next({
    request,
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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options: opts }) =>
            supabaseResponse.cookies.set(name, value, opts),
          );
        },
      },
    },
  );

  await supabase.auth.getClaims();

  if (checkName) {
    const redirect = await checkNameRequirement(request, supabase);
    if (redirect) {
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }
  }

  return supabaseResponse;
}

/** תאימות לאחור — רק רענון סשן */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  return runMiddlewareSession(request, { checkName: false });
}
