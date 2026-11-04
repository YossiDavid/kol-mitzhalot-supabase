import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/app-url";
import { hasRole } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { recordActivity } from "@/features/admin/lib/record-activity";
import { isSameOriginRequest } from "@/lib/request-guards";
import { formatFullName } from "@/lib/user-display-name";
import {
  IMPERSONATION_TARGET_COOKIE,
  IMPERSONATION_TARGET_MAX_AGE_SECONDS,
} from "@/lib/impersonation";

/**
 * POST /api/v1/admin/impersonate
 * Generates a magic link for the target user so an admin can "log in as" that user.
 * Only users with role === "admin" can call this.
 */
const bodySchema = z.object({ userId: z.guid() });

export async function POST(req: NextRequest) {
  noStore();

  // פעולה רגישה מאוד: רק מדף של האתר עצמו (לא מטופס באתר זר)
  if (!isSameOriginRequest(req.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }
    const { userId } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = hasRole(currentUser, "admin");
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Don't allow impersonating yourself
    if (currentUser.id === userId) {
      return NextResponse.json(
        { error: "Cannot impersonate yourself" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: targetUser, error: getUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (getUserError || !targetUser.user?.email) {
      return NextResponse.json(
        { error: "User not found or has no email" },
        { status: 404 },
      );
    }

    // התחזות למנהל אחר הייתה נותנת את כל ההרשאות שלו בלי עקבות
    if (hasRole(targetUser.user, "admin")) {
      return NextResponse.json(
        { error: "Cannot impersonate an admin" },
        { status: 403 },
      );
    }

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.user.email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Error generating impersonation link:", linkError);
      return NextResponse.json(
        { error: "Failed to generate login link" },
        { status: 500 },
      );
    }

    // הדומיין שממנו המנהל פועל בפועל (beta.kolmitzhalot.org.il / preview /
    // localhost) — אחרת ההתחזות זורקת אותו לדומיין ה-deployment של Vercel
    const origin = getRequestOrigin(req.headers);
    const redirectUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=magiclink&next=/app`;

    const meta = targetUser.user.user_metadata ?? {};
    await recordActivity(adminClient, {
      actorId: currentUser.id,
      action: "user.impersonate",
      entityType: "user",
      entityId: userId,
      summary:
        formatFullName(meta.firstName, meta.lastName) ||
        targetUser.user.email ||
        "משתמש",
      details: {},
    });

    const response = NextResponse.json({ redirectUrl });
    // "נראה לאחרונה" של המשתמש לא יתעדכן בזמן ההתחזות (lib/supabase/proxy.ts)
    response.cookies.set(IMPERSONATION_TARGET_COOKIE, userId, {
      maxAge: IMPERSONATION_TARGET_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Impersonate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
