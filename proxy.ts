import { runMiddlewareSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // Dev-only routes (design system showcase, etc.)
  if (
    url.pathname.startsWith("/dev") &&
    process.env.NODE_ENV !== "development"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // When Supabase falls back to Site URL (redirect not allow-listed),
  // auth params land on `/`. Forward them to /auth/confirm.
  if (
    url.pathname === "/" &&
    (url.searchParams.has("token_hash") || url.searchParams.has("code"))
  ) {
    const confirmUrl = new URL("/auth/confirm", url.origin);
    confirmUrl.search = url.search;
    if (!confirmUrl.searchParams.has("next")) {
      confirmUrl.searchParams.set("next", "/app");
    }
    return NextResponse.redirect(confirmUrl);
  }

  return runMiddlewareSession(request, { checkName: true });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
