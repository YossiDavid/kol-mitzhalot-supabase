import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/app-url";
import { unstable_noStore as noStore } from "next/cache";

/**
 * POST /api/v1/admin/impersonate
 * Generates a magic link for the target user so an admin can "log in as" that user.
 * Only users with role === "admin" can call this.
 */
export async function POST(req: NextRequest) {
  noStore();

  try {
    const body = await req.json();
    const { userId }: { userId?: string } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = currentUser.user_metadata?.role === "admin";
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

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.user.email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Error generating impersonation link:", linkError);
      return NextResponse.json(
        { error: linkError?.message ?? "Failed to generate login link" },
        { status: 500 },
      );
    }

    const origin = getAppOrigin();
    const redirectUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=magiclink&next=/app`;

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error("Impersonate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
