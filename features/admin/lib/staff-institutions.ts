import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * שיוך איש צוות למוסדות ע"י מנהל (עורך התפקידים). הכתיבה עצמה נעשית בפונקציית
 * SQL אחת אטומית (admin_set_staff_institutions, service_role בלבד): staff_info
 * מאושר + staff_institutions בדיוק כרשימה שנבחרה. הקובץ הזה מוסיף אימות של
 * המוסדות, צילום מצב קודם ושחזור אם כתיבת התפקיד נכשלה.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const STAFF_INFO_SNAPSHOT_COLUMNS =
  "application_status, approved_at, rejected_at, rejected_reason, institution_id";

export type StaffInstitutionsSnapshot = {
  links: { institution_id: string; position: string | null }[];
  staffInfo: {
    application_status: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    rejected_reason: string | null;
    institution_id: string | null;
  } | null;
};

export type StaffInstitutionsResult =
  | { ok: true }
  | { ok: false; status: 400 | 500; message: string };

/** מוודא שכל המוסדות קיימים ופעילים; מחזיר הודעת שגיאה בעברית או null */
export async function findInvalidInstitutionsError(
  admin: AdminClient,
  institutionIds: readonly string[],
): Promise<StaffInstitutionsResult> {
  const { data, error } = await admin
    .from("institutions")
    .select("id")
    .in("id", [...institutionIds])
    .eq("is_active", true);

  if (error) {
    console.error("[admin/staff-institutions] validate", error);
    return { ok: false, status: 500, message: "שגיאה בבדיקת המוסדות שנבחרו" };
  }
  if ((data ?? []).length !== new Set(institutionIds).size) {
    return {
      ok: false,
      status: 400,
      message: "אחד המוסדות שנבחרו אינו קיים או אינו פעיל",
    };
  }
  return { ok: true };
}

/** המצב הנוכחי (שיוכים + staff_info) לפני שינוי, כדי שאפשר יהיה לשחזר */
export async function snapshotStaffInstitutions(
  admin: AdminClient,
  userId: string,
): Promise<
  | { ok: true; snapshot: StaffInstitutionsSnapshot }
  | { ok: false; message: string }
> {
  const [links, info] = await Promise.all([
    admin
      .from("staff_institutions")
      .select("institution_id, position")
      .eq("user_id", userId),
    admin
      .from("staff_info")
      .select(STAFF_INFO_SNAPSHOT_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (links.error || info.error) {
    console.error(
      "[admin/staff-institutions] snapshot",
      links.error ?? info.error,
    );
    return { ok: false, message: "שגיאה בשליפת שיוך המוסדות הקיים" };
  }

  return {
    ok: true,
    snapshot: {
      links: links.data ?? [],
      staffInfo: info.data,
    },
  };
}

/** קורא לפונקציית ה-SQL. רשימה ריקה = ניקוי כל השיוכים (הסרת התפקיד) */
export async function setStaffInstitutions(
  admin: AdminClient,
  userId: string,
  institutionIds: readonly string[],
): Promise<StaffInstitutionsResult> {
  const { error } = await admin.rpc("admin_set_staff_institutions", {
    p_user_id: userId,
    p_institution_ids: [...institutionIds],
  });

  if (error) {
    console.error("[admin/staff-institutions] rpc", error);
    return { ok: false, status: 500, message: "שגיאה בשיוך איש הצוות למוסדות" };
  }
  return { ok: true };
}

/**
 * שחזור best-effort של המצב הקודם אחרי שכתיבת התפקיד נכשלה. בלי תפקיד staff
 * אין גישה לכרטיסים בכל מקרה, כך שגם אם השחזור עצמו נכשל המצב נשאר בטוח
 * (נרשם ללוג).
 */
export async function restoreStaffInstitutions(
  admin: AdminClient,
  userId: string,
  snapshot: StaffInstitutionsSnapshot,
): Promise<void> {
  const { error: clearError } = await admin
    .from("staff_institutions")
    .delete()
    .eq("user_id", userId);
  if (clearError) {
    console.error("[admin/staff-institutions] restore clear", clearError);
  } else if (snapshot.links.length > 0) {
    const { error: linkError } = await admin
      .from("staff_institutions")
      .insert(snapshot.links.map((link) => ({ user_id: userId, ...link })));
    if (linkError) {
      console.error("[admin/staff-institutions] restore links", linkError);
    }
  }

  if (!snapshot.staffInfo) {
    const { error } = await admin
      .from("staff_info")
      .delete()
      .eq("user_id", userId);
    if (error) console.error("[admin/staff-institutions] restore", error);
    return;
  }

  const { error } = await admin
    .from("staff_info")
    .update(snapshot.staffInfo)
    .eq("user_id", userId);
  if (error) console.error("[admin/staff-institutions] restore", error);
}
