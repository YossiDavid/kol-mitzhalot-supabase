import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Get user information by user ID
 * Returns user metadata (firstName, lastName) from auth.users
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  noStore();
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Verify the requesting user is authenticated
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client to get user metadata
    const adminClient = createAdminClient();
    const {
      data: { user },
      error,
    } = await adminClient.auth.admin.getUserById(userId);

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return only safe user metadata
    const userMetadata = user.user_metadata || {};
    return NextResponse.json({
      id: user.id,
      firstName: userMetadata.firstName || null,
      lastName: userMetadata.lastName || null,
      email: user.email || null,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
