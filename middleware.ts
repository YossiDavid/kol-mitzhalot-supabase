import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // When Supabase sends the magic link to the Site URL instead of /auth/confirm,
  // the token_hash lands on the homepage as a query param. Forward it to /auth/confirm.
  if (url.pathname === "/" && url.searchParams.has("token_hash")) {
    const confirmUrl = new URL("/auth/confirm", url.origin);
    confirmUrl.search = url.search;
    return NextResponse.redirect(confirmUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",],
};
