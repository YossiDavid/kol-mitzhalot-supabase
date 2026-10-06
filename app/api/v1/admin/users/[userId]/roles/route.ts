import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasRole, primaryRole } from "@/lib/user";
import { updateUserRoles } from "@/lib/supabase/user-roles";
import type { Role } from "@/lib/user";
import {
  findInvalidInstitutionsError,
  restoreStaffInstitutions,
  setStaffInstitutions,
  snapshotStaffInstitutions,
  type StaffInstitutionsSnapshot,
} from "@/features/admin/lib/staff-institutions";

// עדכון תפקידי משתמש (multi-role) ע"י מנהל - מסך app/app/admin/users/[id].
// admin/shadchan/staff בלבד ניתנים לעריכה; "user" הוא ברירת המחדל המשתמעת
// (מערך roles ריק) ולא מוצג לבחירה.
//
// כאשר roles כוללים "staff" חובה לבחור לפחות מוסד אחד (institutionIds): הגישה
// לכרטיסים (public.staff_can_access_student) דורשת תפקיד + staff_info מאושר +
// שורת staff_institutions למוסד הכרטיס. סדר הפעולות בהענקה: שיוך המוסדות
// (פונקציית SQL אטומית) ורק אחריו כתיבת התפקיד; נכשלה כתיבת התפקיד - המצב
// הקודם משוחזר. בהסרה: קודם התפקיד (הגישה נחתכת מיד), ואז ניקוי השיוכים.
const MAX_STAFF_INSTITUTIONS = 50;

const bodySchema = z.object({
  roles: z.array(z.enum(["admin", "shadchan", "staff"])).max(3),
  institutionIds: z.array(z.guid()).max(MAX_STAFF_INSTITUTIONS).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  noStore();

  const { userId } = await params;
  if (!z.guid().safeParse(userId).success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
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

  // admin client (service role) חובה כאן: כתיבת staff_info / staff_institutions
  // של משתמש אחר ו-app_metadata אפשרית רק עם מפתח ה-service role.
  const admin = createAdminClient();
  const isGrantingStaff = nextRoles.includes("staff");
  const institutionIds = Array.from(new Set(parsed.data.institutionIds ?? []));

  let snapshot: StaffInstitutionsSnapshot | null = null;

  if (isGrantingStaff) {
    if (institutionIds.length === 0) {
      return NextResponse.json(
        { error: "יש לבחור לפחות מוסד לימודים אחד לאיש צוות" },
        { status: 400 },
      );
    }

    const validation = await findInvalidInstitutionsError(
      admin,
      institutionIds,
    );
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.message },
        { status: validation.status },
      );
    }

    const before = await snapshotStaffInstitutions(admin, userId);
    if (!before.ok) {
      return NextResponse.json({ error: before.message }, { status: 500 });
    }
    snapshot = before.snapshot;

    const linked = await setStaffInstitutions(admin, userId, institutionIds);
    if (!linked.ok) {
      await restoreStaffInstitutions(admin, userId, snapshot);
      return NextResponse.json(
        { error: linked.message },
        { status: linked.status },
      );
    }
  }

  // התפקידים נכתבים ל-app_metadata.roles (לא user_metadata - את זה המשתמש עצמו
  // יכול לכתוב). updateUserRoles ממזג את app_metadata הקיים ולא דורס אותו.
  const roleUpdate = await updateUserRoles(admin, userId, () => nextRoles);

  if (!roleUpdate.ok) {
    console.error("[admin/users/roles]", roleUpdate.message);
    if (snapshot) {
      await restoreStaffInstitutions(admin, userId, snapshot);
    }
    return NextResponse.json(
      { error: roleUpdate.message },
      { status: roleUpdate.status },
    );
  }

  // הסרת התפקיד: מנקים את שיוכי המוסדות (staff_info נשאר כהיסטוריה). כשל כאן
  // אינו משאיר גישה - התפקיד כבר הוסר - אבל מדווחים עליו במפורש.
  if (!isGrantingStaff) {
    const cleared = await setStaffInstitutions(admin, userId, []);
    if (!cleared.ok) {
      return NextResponse.json(
        {
          error:
            "התפקידים עודכנו, אך ניקוי שיוכי המוסדות נכשל. המשתמש אינו רואה כרטיסים, ניתן לנסות שוב",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    roles: roleUpdate.roles,
    role: primaryRole(roleUpdate.user),
    institutionIds: isGrantingStaff ? institutionIds : [],
  });
}
