import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * איש צוות מאושר של מוסד חדש, לבדיקות הרשאה: כרטיס ששייך למוסד הזה גלוי לו
 * (staff_can_access_student). מחזיר את מזהה איש הצוות והמוסד, ופונקציית ניקוי.
 */
export const GATE_STAFF_EMAIL = "playwright-gate-staff@kol-mitzhalot.test";
const GATE_STAFF_PHONE = "+972500000047";

async function ensureStaffUserId(admin: SupabaseClient): Promise<string> {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users.find((user) => user.email === GATE_STAFF_EMAIL);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: GATE_STAFF_EMAIL,
    phone: GATE_STAFF_PHONE,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles: ["staff"] },
    user_metadata: { firstName: "Gate", lastName: "Staff" },
  });
  if (error || !data.user) {
    throw new Error(`יצירת איש צוות לבדיקה נכשלה: ${error?.message}`);
  }
  return data.user.id;
}

export async function setupInstitutionStaff(
  admin: SupabaseClient,
  label: string,
): Promise<{
  staffId: string;
  institutionId: string;
  cleanup: () => Promise<void>;
}> {
  const staffId = await ensureStaffUserId(admin);
  const { data: institution, error } = await admin
    .from("institutions")
    .insert({ name: `מוסד ${label}`, gender: "male", type: "yeshiva_gedola" })
    .select("id")
    .single();
  if (error || !institution) {
    throw new Error(`יצירת מוסד לבדיקה נכשלה: ${error?.message}`);
  }
  const institutionId = institution.id as string;
  const info = await admin.from("staff_info").upsert(
    {
      user_id: staffId,
      institution_id: institutionId,
      application_status: "approved",
    },
    { onConflict: "user_id" },
  );
  if (info.error) throw new Error(info.error.message);
  const link = await admin
    .from("staff_institutions")
    .upsert(
      { user_id: staffId, institution_id: institutionId },
      { onConflict: "user_id,institution_id" },
    );
  if (link.error) throw new Error(link.error.message);

  return {
    staffId,
    institutionId,
    cleanup: async () => {
      await admin.from("staff_institutions").delete().eq("user_id", staffId);
      await admin.from("staff_info").delete().eq("user_id", staffId);
      await admin.from("institutions").delete().eq("id", institutionId);
    },
  };
}
