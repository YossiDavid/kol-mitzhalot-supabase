import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole, pickHighestPrecedenceRole } from "@/lib/user";
import type { Role } from "@/lib/user";

// עדכון תפקידי משתמש (multi-role) ע"י מנהל - מסך app/app/admin/users/[id].
// admin/shadchan/staff בלבד ניתנים לעריכה; "user" הוא ברירת המחדל המשתמעת
// (מערך roles ריק) ולא מוצג לבחירה.
const bodySchema = z.object({
  roles: z.array(z.enum(["admin", "shadchan", "staff"])).max(3),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  noStore();

  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(currentUser, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nextRoles: Role[] = Array.from(new Set(parsed.data.roles));

  // הגנה: מנהל לא יכול להסיר מעצמו את תפקיד ה-admin - זה עלול לנעול את כולם
  // (כולל אותו) מחוץ למסכי הניהול
  if (currentUser.id === userId && !nextRoles.includes("admin")) {
    return NextResponse.json(
      { error: "לא ניתן להסיר מעצמך את הרשאת המנהל" },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  // שליפת המשתמש הקיים לפני העדכון: updateUserById מחליף את כל ה-user_metadata
  // באובייקט שמועבר, ולכן חובה למזג לתוכו את המטא-דאטה הקיימת (firstName,
  // lastName, phone וכו') ולא רק להעביר roles - אחרת הנתונים האלה נמחקים.
  const { data: existingUserData, error: fetchError } =
    await admin.auth.admin.getUserById(userId);

  if (fetchError || !existingUserData.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: updateData, error: updateError } =
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingUserData.user.user_metadata,
        roles: nextRoles,
        role: pickHighestPrecedenceRole(nextRoles),
      },
    });

  if (updateError || !updateData.user) {
    console.error("[admin/users/roles]", updateError);
    return NextResponse.json(
      { error: updateError?.message || "Failed to update roles" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    roles: nextRoles,
    role: updateData.user.user_metadata?.role,
  });
}
