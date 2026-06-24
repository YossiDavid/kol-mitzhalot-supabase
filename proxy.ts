import { runMiddlewareSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // When Supabase sends the magic link to the Site URL instead of /auth/confirm,
  // the token_hash lands on the homepage. Forward it to /auth/confirm.
  if (url.pathname === "/" && url.searchParams.has("token_hash")) {
    const confirmUrl = new URL("/auth/confirm", url.origin);
    confirmUrl.search = url.search;
    return NextResponse.redirect(confirmUrl);
  }

  return runMiddlewareSession(request, { checkName: true });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
