import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

export async function POST(req: NextRequest) {
  noStore();

  try {
    const body = await req.json();
    const { userId, reason }: { userId?: string; reason?: string } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Verify the requesting user is authenticated and is an admin
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

    // עדכון הסטטוס ב-shadchanim_info
    const { error: dbError } = await supabase
      .from("shadchanim_info")
      .update({
        application_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_reason: reason || null,
      })
      .eq("user_id", userId);

    if (dbError) {
      console.error("Error updating application status:", dbError);
      return NextResponse.json(
        { error: dbError.message || "Failed to reject application" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application rejected successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error rejecting application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
