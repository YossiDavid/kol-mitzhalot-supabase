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
//
// כאשר roles כוללים "staff": חובה שלמשתמש תהיה רשומת staff_info מאושרת עם
// institution_id לא ריק, אחרת public.staff_can_access_student דורש התאמת
// institution_id ולא יאפשר לו לראות/לכתוב על אף כרטיס (ראה לוגיקה בהמשך).
// institutionId מגיע מהלקוח כדי לאפשר למנהל למנות איש צוות ישירות, במקביל
// למסלול הקיים של הרשמה-ואישור (app/app/settings/staff -> app/app/admin/staff/requests).
const bodySchema = z.object({
  roles: z.array(z.enum(["admin", "shadchan", "staff"])).max(3),
  institutionId: z.string().uuid().nullable().optional(),
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

  // admin client (service role) חובה כאן: RLS על staff_info מתירה כתיבה רק
  // לבעל הרשומה עצמו (auth.uid() = user_id) או למנהל שפועל מתוך session
  // תואם - אבל כאן המנהל כותב רשומה של משתמש אחר דרך API route, ללא session
  // כזה, ולכן יש לעקוף את RLS עם מפתח ה-service role.
  const admin = createAdminClient();

  if (nextRoles.includes("staff")) {
    const staffInfoError = await ensureApprovedStaffInfo(
      admin,
      userId,
      parsed.data.institutionId ?? null,
    );
    if (staffInfoError) {
      return staffInfoError;
    }
  }

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

/**
 * מוודא שלמשתמש שמקבל תפקיד "staff" יש רשומת staff_info מאושרת עם מוסד -
 * אחרת public.staff_can_access_student יחזיר תמיד false והמשתמש לא יראה/יוכל
 * לכתוב על אף כרטיס, למרות שיש לו את התפקיד (זו הבעיה שתוקנה כאן).
 *
 * - אם סופק institutionId: מאמת שהמוסד קיים ופעיל, ואז עושה UPSERT לרשומת
 *   staff_info עם institution_id, application_status='approved' ו-approved_at
 *   עדכני, תוך שימור city/position קיימים אם יש.
 * - אם לא סופק institutionId: בודק שכבר קיימת רשומה עם institution_id לא
 *   ריק - ואם כן, רק מוודא שהיא מאושרת. אם אין רשומה כזו, מחזיר 400 כי אי
 *   אפשר להעניק תפקיד staff בלי מוסד.
 *
 * מחזיר NextResponse (שגיאה) שיש להחזיר מיד מה-handler, או null אם הכל תקין.
 */
async function ensureApprovedStaffInfo(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  institutionId: string | null,
): Promise<NextResponse | null> {
  if (institutionId) {
    const { data: institution, error: institutionError } = await admin
      .from("institutions")
      .select("id, is_active")
      .eq("id", institutionId)
      .maybeSingle();

    if (institutionError) {
      console.error("[admin/users/roles]", institutionError);
      return NextResponse.json(
        { error: "שגיאה בבדיקת המוסד שנבחר" },
        { status: 500 },
      );
    }

    if (!institution || !institution.is_active) {
      return NextResponse.json(
        { error: "המוסד שנבחר אינו קיים או אינו פעיל" },
        { status: 400 },
      );
    }

    // שליפת הרשומה הקיימת (אם יש) כדי לשמר city/position ולא לאפס אותם
    const { data: existingStaffInfo, error: existingStaffInfoError } =
      await admin
        .from("staff_info")
        .select("city, position")
        .eq("user_id", userId)
        .maybeSingle();

    if (existingStaffInfoError) {
      console.error("[admin/users/roles]", existingStaffInfoError);
      return NextResponse.json(
        { error: "שגיאה בשליפת נתוני איש הצוות הקיימים" },
        { status: 500 },
      );
    }

    const { error: upsertError } = await admin.from("staff_info").upsert(
      {
        user_id: userId,
        institution_id: institutionId,
        city: existingStaffInfo?.city ?? null,
        position: existingStaffInfo?.position ?? null,
        application_status: "approved",
        approved_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      console.error("[admin/users/roles]", upsertError);
      return NextResponse.json(
        { error: "שגיאה בשיוך איש הצוות למוסד" },
        { status: 500 },
      );
    }

    return null;
  }

  // לא סופק מוסד - יש לבדוק שכבר קיימת רשומה עם מוסד משויך
  const { data: existingStaffInfo, error: existingStaffInfoError } = await admin
    .from("staff_info")
    .select("institution_id, application_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingStaffInfoError) {
    console.error("[admin/users/roles]", existingStaffInfoError);
    return NextResponse.json(
      { error: "שגיאה בשליפת נתוני איש הצוות הקיימים" },
      { status: 500 },
    );
  }

  if (!existingStaffInfo || !existingStaffInfo.institution_id) {
    return NextResponse.json(
      {
        error:
          "יש לבחור מוסד לפני הענקת תפקיד איש צוות - למשתמש הזה אין עדיין שיוך למוסד",
      },
      { status: 400 },
    );
  }

  if (existingStaffInfo.application_status !== "approved") {
    const { error: approveError } = await admin
      .from("staff_info")
      .update({
        application_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (approveError) {
      console.error("[admin/users/roles]", approveError);
      return NextResponse.json(
        { error: "שגיאה באישור רשומת איש הצוות" },
        { status: 500 },
      );
    }
  }

  return null;
}
