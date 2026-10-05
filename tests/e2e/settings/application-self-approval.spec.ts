import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * הפרצה שנסגרה: בקשת ההצטרפות כאיש צוות / שדכן נכתבת מהדפדפן
 * (staff_info, shadchanim_info, staff_institutions), ופונקציות הגישה
 * (staff_can_access_student, is_approved_shadchan) סמכו על
 * application_status ועל שיוך למוסד בלבד. כל משתמש מחובר יכול היה לכתוב
 * לעצמו שורה "מאושרת" ולקרוא כל כרטיס של מוסד. הבדיקות מריצות את ההתקפה
 * בסשן אמיתי של משתמש בלי תפקידים, ואת התהליך הלגיטימי (הגשה, אישור מנהל,
 * הענקת התפקיד) כדי לוודא שנשאר תקין.
 */
const APPLICANT = {
  email: "playwright-applicant@kol-mitzhalot.test",
  firstName: "Applicant",
  lastName: "Tester",
  phone: "+972500000031",
};
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const INSTITUTION_GENDER = "male";
const INSTITUTION_TYPE = "yeshiva_gedola";

test.describe("הצהרה עצמית כאיש צוות / שדכן מאושר", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let applicantId: string;
  let applicant: SupabaseClient;
  let institutionId: string;
  let otherInstitutionId: string;
  let studentId: string;
  let otherStudentId: string;
  let ownerId: string;

  async function ensureApplicant(): Promise<string> {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users?.users.find((u) => u.email === APPLICANT.email);
    const userMetadata = {
      firstName: APPLICANT.firstName,
      lastName: APPLICANT.lastName,
      phone: APPLICANT.phone,
      phone_verified: true,
    };
    let userId: string;
    if (existing) {
      userId = existing.id;
      const { error } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { ...existing.app_metadata, roles: [] },
        user_metadata: userMetadata,
      });
      if (error) throw new Error(`איפוס המגיש נכשל: ${error.message}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: APPLICANT.email,
        phone: APPLICANT.phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: userMetadata,
      });
      if (error || !data.user) {
        throw new Error(`יצירת המגיש נכשלה: ${error?.message}`);
      }
      userId = data.user.id;
    }
    await admin.from("user_profiles").upsert({
      id: userId,
      first_name: APPLICANT.firstName,
      last_name: APPLICANT.lastName,
    });
    return userId;
  }

  async function createInstitution(label: string): Promise<string> {
    const { data, error } = await admin
      .from("institutions")
      .insert({
        name: `${label} ${Date.now()}`,
        city: "בני ברק",
        gender: INSTITUTION_GENDER,
        type: INSTITUTION_TYPE,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת מוסד: ${error?.message}`);
    return data.id as string;
  }

  async function createStudentIn(institution: string): Promise<string> {
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: ownerId,
        first_name: "תלמיד",
        last_name: "מוסד",
        birth_date: "1999-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        institution_id: institution,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת כרטיס: ${error?.message}`);
    return data.id as string;
  }

  /** מחזיר את המגיש למצב "משתמש רגיל בלי בקשה" */
  async function resetApplicant() {
    await admin.from("staff_institutions").delete().eq("user_id", applicantId);
    await admin.from("staff_info").delete().eq("user_id", applicantId);
    await admin.from("shadchanim_info").delete().eq("user_id", applicantId);
    const { data } = await admin.auth.admin.getUserById(applicantId);
    await admin.auth.admin.updateUserById(applicantId, {
      app_metadata: { ...data.user?.app_metadata, roles: [] },
    });
  }

  const staffRow = async () => {
    const { data } = await admin
      .from("staff_info")
      .select("application_status, approved_at, institution_id")
      .eq("user_id", applicantId)
      .maybeSingle();
    return data;
  };

  const canSeeStudent = async (client: SupabaseClient, id: string) => {
    const { data } = await client.from("students").select("id").eq("id", id);
    return (data ?? []).length === 1;
  };

  const tryForumPost = async (client: SupabaseClient) =>
    client
      .from("forum_posts")
      .insert({ title: "כותרת", content: "תוכן", author_id: applicantId })
      .select("id");

  test.beforeAll(async () => {
    admin = createServiceClient();
    applicantId = await ensureApplicant();
    ownerId = await ensureCardManagerId(admin);
    institutionId = await createInstitution("מוסד בדיקה א");
    otherInstitutionId = await createInstitution("מוסד בדיקה ב");
    studentId = await createStudentIn(institutionId);
    otherStudentId = await createStudentIn(otherInstitutionId);
    await resetApplicant();
    applicant = await clientAs(admin, APPLICANT.email);
  });

  test.afterAll(async () => {
    await resetApplicant();
    await admin.from("students").delete().in("id", [studentId, otherStudentId]);
    await admin
      .from("institutions")
      .delete()
      .in("id", [institutionId, otherInstitutionId]);
  });

  test("הכנסה עצמית של בקשה 'מאושרת' + מוסד: הסטטוס נכפה ל-pending, אין גישה לכרטיסים ואין כתיבה בפורום", async () => {
    // Act
    const info = await applicant.from("staff_info").insert({
      user_id: applicantId,
      institution_id: institutionId,
      application_status: "approved",
      approved_at: new Date().toISOString(),
    });
    const affiliation = await applicant
      .from("staff_institutions")
      .insert({ user_id: applicantId, institution_id: institutionId });
    const post = await tryForumPost(applicant);

    // Assert
    expect(info.error).toBeNull();
    expect(affiliation.error).toBeNull();
    const row = await staffRow();
    expect(row?.application_status).toBe("pending");
    expect(row?.approved_at).toBeNull();
    expect(await canSeeStudent(applicant, studentId)).toBe(false);
    expect(post.error).not.toBeNull();
  });

  test("גם שורה 'מאושרת' אמיתית בלי תפקיד staff לא נותנת גישה ולא כתיבה בפורום", async () => {
    // Arrange - מצב שבו מישהו כתב status=approved בלי שהוענק תפקיד
    await admin
      .from("staff_info")
      .update({ application_status: "approved" })
      .eq("user_id", applicantId);

    // Act
    const post = await tryForumPost(applicant);

    // Assert
    expect((await staffRow())?.application_status).toBe("approved");
    expect(await canSeeStudent(applicant, studentId)).toBe(false);
    expect(post.error).not.toBeNull();
  });

  test("לא ניתן לאשר את עצמך: update ו-upsert על שורה קיימת משאירים pending", async () => {
    // Arrange
    await resetApplicant();
    await applicant.from("staff_info").insert({
      user_id: applicantId,
      institution_id: institutionId,
    });

    // Act
    await applicant
      .from("staff_info")
      .update({
        application_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("user_id", applicantId);
    await applicant
      .from("staff_info")
      .upsert(
        { user_id: applicantId, application_status: "approved" },
        { onConflict: "user_id" },
      );

    // Assert
    const row = await staffRow();
    expect(row?.application_status).toBe("pending");
    expect(row?.approved_at).toBeNull();
  });

  test("אותו דבר בשדכנים: לא ניתן לאשר את עצמך, ופורום סגור", async () => {
    // Act
    await applicant.from("shadchanim_info").insert({
      user_id: applicantId,
      application_status: "approved",
      approved_at: new Date().toISOString(),
    });
    await applicant
      .from("shadchanim_info")
      .update({ application_status: "approved" })
      .eq("user_id", applicantId);
    const post = await tryForumPost(applicant);

    // Assert
    const { data } = await admin
      .from("shadchanim_info")
      .select("application_status, approved_at")
      .eq("user_id", applicantId)
      .single();
    expect(data?.application_status).toBe("pending");
    expect(data?.approved_at).toBeNull();
    expect(post.error).not.toBeNull();
  });

  test("הגשה מחדש אחרי דחייה חוזרת ל-pending ושומרת את סיבת הדחייה", async () => {
    // Arrange
    await admin
      .from("shadchanim_info")
      .update({
        application_status: "rejected",
        rejected_reason: "חסר מידע",
        rejected_at: new Date().toISOString(),
      })
      .eq("user_id", applicantId);

    // Act
    const resubmit = await applicant
      .from("shadchanim_info")
      .update({ application_status: "pending", rejected_reason: null })
      .eq("user_id", applicantId);

    // Assert
    expect(resubmit.error).toBeNull();
    const { data } = await admin
      .from("shadchanim_info")
      .select("application_status, rejected_reason")
      .eq("user_id", applicantId)
      .single();
    expect(data?.application_status).toBe("pending");
    expect(data?.rejected_reason).toBe("חסר מידע");
  });

  test("התהליך הלגיטימי: הגשה, אישור מנהל והענקת תפקיד - נותנים גישה למוסד בלבד", async () => {
    // Arrange - הגשה כמו בטופס (שורת staff_info + שיוך למוסד)
    await resetApplicant();
    const submitted = await applicant.from("staff_info").upsert(
      {
        user_id: applicantId,
        institution_id: institutionId,
        application_status: "pending",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    const affiliated = await applicant
      .from("staff_institutions")
      .upsert(
        { user_id: applicantId, institution_id: institutionId },
        { onConflict: "user_id,institution_id" },
      );
    expect(submitted.error).toBeNull();
    expect(affiliated.error).toBeNull();
    expect(await canSeeStudent(applicant, studentId)).toBe(false);

    // Act - מנהל מאשר בסשן שלו (כמו נתיב האישור), והתפקיד מוענק ב-service role
    const adminSession = await clientAs(admin, ADMIN_EMAIL);
    const approval = await adminSession
      .from("staff_info")
      .update({
        application_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("user_id", applicantId)
      .select("user_id");
    await admin.auth.admin.updateUserById(applicantId, {
      app_metadata: { roles: ["staff"] },
    });

    // Assert
    expect(approval.error).toBeNull();
    expect(approval.data).toHaveLength(1);
    expect((await staffRow())?.application_status).toBe("approved");
    expect(await canSeeStudent(applicant, studentId)).toBe(true);
    expect(await canSeeStudent(applicant, otherStudentId)).toBe(false);
  });

  test("איש צוות אמיתי לא יכול להפנות את עצמו למוסד אחר", async () => {
    // Act
    const repoint = await applicant
      .from("staff_institutions")
      .update({ institution_id: otherInstitutionId })
      .eq("user_id", applicantId)
      .select("institution_id");
    const addAnother = await applicant
      .from("staff_institutions")
      .insert({ user_id: applicantId, institution_id: otherInstitutionId });
    const removeOwn = await applicant
      .from("staff_institutions")
      .delete()
      .eq("user_id", applicantId)
      .select("institution_id");
    await applicant
      .from("staff_info")
      .update({ institution_id: otherInstitutionId })
      .eq("user_id", applicantId);

    // Assert
    expect(repoint.data ?? []).toHaveLength(0);
    expect(addAnother.error).not.toBeNull();
    expect(removeOwn.data ?? []).toHaveLength(0);
    const { data: affiliations } = await admin
      .from("staff_institutions")
      .select("institution_id")
      .eq("user_id", applicantId);
    expect((affiliations ?? []).map((a) => a.institution_id)).toEqual([
      institutionId,
    ]);
    expect((await staffRow())?.institution_id).toBe(institutionId);
    expect(await canSeeStudent(applicant, otherStudentId)).toBe(false);
  });

  test("מנהל עדיין יכול לנהל שיוך מוסדות של איש צוות", async () => {
    // Act
    const adminSession = await clientAs(admin, ADMIN_EMAIL);
    const added = await adminSession
      .from("staff_institutions")
      .insert({ user_id: applicantId, institution_id: otherInstitutionId });

    // Assert
    expect(added.error).toBeNull();
    expect(await canSeeStudent(applicant, otherStudentId)).toBe(true);
  });
});
