import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole, pickHighestPrecedenceRole } from "@/lib/user";
import type { Role } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";

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

    // Verify the requesting user is authenticated and is an admin
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

    const adminClient = createAdminClient();

    // שליפת המשתמש הקיים לפני העדכון: updateUserById מחליף את כל ה-user_metadata
    // באובייקט שמועבר, ולכן חובה למזג לתוכו את המטא-דאטה הקיימת (firstName,
    // lastName, phone וכו') ולהוסיף shadchan לרשימת ה-roles הקיימת בלי לדרוס
    // אותה - דריסת role היא בדיוק הבאג שהוריד למשתמש אמיתי (hello@shos.digital)
    // את הרשאות השדכן שלו כשהוא אושר בנפרד כאיש צוות.
    const { data: existingUserData, error: fetchError } =
      await adminClient.auth.admin.getUserById(userId);

    if (fetchError || !existingUserData.user) {
      console.error("Error fetching user before approval:", fetchError);
      return NextResponse.json(
        { error: fetchError?.message || "User not found" },
        { status: 404 },
      );
    }

    const existingRoles: Role[] = Array.isArray(
      existingUserData.user.user_metadata?.roles,
    )
      ? (existingUserData.user.user_metadata?.roles as Role[])
      : [];
    const nextRoles = Array.from(
      new Set([...existingRoles, "shadchan" as Role]),
    );

    // עדכון התפקיד של המשתמש: מוסיפים shadchan ל-roles ושומרים גם role (הסקלר
    // הישן) לפי סדר העדיפות, כדי שקוד שעדיין לא הומר ל-hasRole ימשיך לעבוד
    const { data: updateData, error: updateError } =
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingUserData.user.user_metadata,
          roles: nextRoles,
          role: pickHighestPrecedenceRole(nextRoles),
        },
      });

    if (updateError || !updateData.user) {
      console.error("Error updating user role:", updateError);
      return NextResponse.json(
        { error: updateError?.message || "Failed to update user role" },
        { status: 500 },
      );
    }

    // עדכון הסטטוס ב-shadchanim_info
    const { error: dbError } = await supabase
      .from("shadchanim_info")
      .update({
        application_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (dbError) {
      console.error("Error updating application status:", dbError);
      // לא נחזיר שגיאה כאן כי התפקיד כבר עודכן
      // אבל נדווח על זה
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application approved successfully",
        user: {
          id: updateData.user.id,
          email: updateData.user.email,
          role: updateData.user.user_metadata?.role,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error approving application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
