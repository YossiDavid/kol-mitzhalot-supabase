import { expect, test } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * מנהל מעניק תפקיד "איש צוות" בעורך התפקידים: חובה לבחור מוסד, והשרת יוצר
 * יחד עם התפקיד את staff_info המאושר ואת שיוכי staff_institutions. בלי זה
 * public.staff_can_access_student לא נותן לאיש הצוות לראות אף כרטיס.
 * הבדיקות רצות בפרויקט האדמין (הדפדפן מחובר כמנהל); הגישה נבדקת דרך RLS
 * בסשן אמיתי של איש הצוות.
 */
const STAFF = {
  email: "playwright-staff-grant@kol-mitzhalot.test",
  firstName: "Staff",
  lastName: "Grant",
  phone: "+972500000041",
};
const INSTITUTION_GENDER = "male";
const INSTITUTION_TYPE = "yeshiva_gedola";
const WARNING_TEXT =
  "למשתמש יש תפקיד צוות אך אינו משויך למוסד, ולכן אינו רואה כרטיסים";
const MISSING_INSTITUTION_TEXT = "יש לבחור לפחות מוסד לימודים אחד";
const UNKNOWN_INSTITUTION_ID = "00000000-0000-4000-8000-00000000dead";

test.describe("הענקת תפקיד צוות בעורך התפקידים", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let staffId: string;
  let ownerId: string;
  let institutionA: string;
  let institutionB: string;
  let studentA: string;
  let studentB: string;
  let nameA: string;

  async function ensureStaffUser(): Promise<string> {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users?.users.find((u) => u.email === STAFF.email);
    const userMetadata = {
      firstName: STAFF.firstName,
      lastName: STAFF.lastName,
      phone: STAFF.phone,
      phone_verified: true,
    };
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...existing.app_metadata, roles: [] },
        user_metadata: userMetadata,
      });
      if (error) throw new Error(`איפוס איש הצוות נכשל: ${error.message}`);
      return existing.id;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: STAFF.email,
      phone: STAFF.phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: userMetadata,
    });
    if (error || !data.user) {
      throw new Error(`יצירת איש הצוות נכשלה: ${error?.message}`);
    }
    return data.user.id;
  }

  async function createInstitution(
    label: string,
  ): Promise<{ id: string; name: string }> {
    const name = `${label} ${Date.now()}`;
    const { data, error } = await admin
      .from("institutions")
      .insert({
        name,
        city: "בני ברק",
        gender: INSTITUTION_GENDER,
        type: INSTITUTION_TYPE,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת מוסד: ${error?.message}`);
    return { id: data.id as string, name };
  }

  async function createStudentIn(institution: string): Promise<string> {
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: ownerId,
        first_name: "תלמיד",
        last_name: "צוות",
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

  /** מחזיר את המשתמש למצב "בלי תפקידים, בלי שיוכים, בלי בקשה" */
  async function resetStaffUser() {
    await admin.from("staff_institutions").delete().eq("user_id", staffId);
    await admin.from("staff_info").delete().eq("user_id", staffId);
    const { data } = await admin.auth.admin.getUserById(staffId);
    await admin.auth.admin.updateUserById(staffId, {
      app_metadata: { ...data.user?.app_metadata, roles: [] },
    });
  }

  const patchRoles = (
    request: import("@playwright/test").APIRequestContext,
    data: { roles: string[]; institutionIds?: string[] },
  ): Promise<APIResponse> =>
    request.patch(`/api/v1/admin/users/${staffId}/roles`, { data });

  const links = async (): Promise<string[]> => {
    const { data } = await admin
      .from("staff_institutions")
      .select("institution_id")
      .eq("user_id", staffId);
    return (data ?? []).map((row) => row.institution_id as string).sort();
  };

  const staffInfo = async () => {
    const { data } = await admin
      .from("staff_info")
      .select("application_status, approved_at")
      .eq("user_id", staffId)
      .maybeSingle();
    return data;
  };

  /** סשן חדש של איש הצוות (ה-JWT נושא את התפקידים העדכניים) */
  const canSee = async (studentId: string): Promise<boolean> => {
    const session = await clientAs(admin, STAFF.email);
    const { data } = await session
      .from("students")
      .select("id")
      .eq("id", studentId);
    return (data ?? []).length === 1;
  };

  test.beforeAll(async () => {
    admin = createServiceClient();
    staffId = await ensureStaffUser();
    ownerId = await ensureCardManagerId(admin);
    const a = await createInstitution("מוסד צוות א");
    const b = await createInstitution("מוסד צוות ב");
    institutionA = a.id;
    nameA = a.name;
    institutionB = b.id;
    studentA = await createStudentIn(institutionA);
    studentB = await createStudentIn(institutionB);
    await resetStaffUser();
  });

  test.afterAll(async () => {
    await resetStaffUser();
    await admin.from("students").delete().in("id", [studentA, studentB]);
    await admin
      .from("institutions")
      .delete()
      .in("id", [institutionA, institutionB]);
  });

  test("הענקת צוות בלי מוסד נדחית ולא משנה כלום", async ({ page }) => {
    // Act
    const noField = await patchRoles(page.request, { roles: ["staff"] });
    const emptyList = await patchRoles(page.request, {
      roles: ["staff"],
      institutionIds: [],
    });
    const unknown = await patchRoles(page.request, {
      roles: ["staff"],
      institutionIds: [UNKNOWN_INSTITUTION_ID],
    });

    // Assert
    expect(noField.status()).toBe(400);
    expect(emptyList.status()).toBe(400);
    expect(unknown.status()).toBe(400);
    const { data } = await admin.auth.admin.getUserById(staffId);
    expect(data.user?.app_metadata?.roles ?? []).toEqual([]);
    expect(await staffInfo()).toBeNull();
    expect(await links()).toEqual([]);
  });

  test("הענקה עם מוסד: staff_info מאושר, שיוך, וגישה לכרטיסי המוסד בלבד", async ({
    page,
  }) => {
    // Act
    const response = await patchRoles(page.request, {
      roles: ["staff"],
      institutionIds: [institutionA],
    });

    // Assert
    expect(response.ok()).toBe(true);
    expect((await staffInfo())?.application_status).toBe("approved");
    expect((await staffInfo())?.approved_at).not.toBeNull();
    expect(await links()).toEqual([institutionA]);
    expect(await canSee(studentA)).toBe(true);
    expect(await canSee(studentB)).toBe(false);
  });

  test("שינוי קבוצת המוסדות מעביר את הגישה", async ({ page }) => {
    // Act - החלפה ל-ב'
    const toB = await patchRoles(page.request, {
      roles: ["staff"],
      institutionIds: [institutionB],
    });

    // Assert
    expect(toB.ok()).toBe(true);
    expect(await links()).toEqual([institutionB]);
    expect(await canSee(studentA)).toBe(false);
    expect(await canSee(studentB)).toBe(true);

    // Act - שני המוסדות
    const both = await patchRoles(page.request, {
      roles: ["staff"],
      institutionIds: [institutionA, institutionB],
    });

    // Assert
    expect(both.ok()).toBe(true);
    expect(await links()).toEqual([institutionA, institutionB].sort());
    expect(await canSee(studentA)).toBe(true);
    expect(await canSee(studentB)).toBe(true);
  });

  test("העמוד מציג את מוסדות איש הצוות ובלי אזהרה", async ({ page }) => {
    // Act
    await page.goto(`/app/admin/users/${staffId}`);

    // Assert
    const summary = page.locator('[data-slot="staff-institutions-summary"]');
    await expect(summary).toContainText(nameA);
    await expect(page.getByText(WARNING_TEXT)).toHaveCount(0);
  });

  test("הסרת התפקיד מוחקת את השיוכים ומשאירה את staff_info כהיסטוריה", async ({
    page,
  }) => {
    // Act
    const response = await patchRoles(page.request, { roles: [] });

    // Assert
    expect(response.ok()).toBe(true);
    const { data } = await admin.auth.admin.getUserById(staffId);
    expect(data.user?.app_metadata?.roles ?? []).toEqual([]);
    expect(await links()).toEqual([]);
    expect((await staffInfo())?.application_status).toBe("approved");
    expect(await canSee(studentA)).toBe(false);
  });

  test("תפקיד צוות בלי שיוך: מוצגת אזהרה", async ({ page }) => {
    // Arrange - מצב שבור קיים: תפקיד בלי שיוך
    await resetStaffUser();
    await admin.auth.admin.updateUserById(staffId, {
      app_metadata: { roles: ["staff"] },
    });

    // Act
    await page.goto(`/app/admin/users/${staffId}`);

    // Assert
    await expect(page.getByText(WARNING_TEXT)).toBeVisible();
    await expect(
      page.locator('[data-slot="staff-institutions-summary"]'),
    ).toHaveCount(0);
  });

  test("בעורך: סימון צוות בלי מוסד מציג הודעה וחוסם שמירה, ובחירת מוסד מאפשרת", async ({
    page,
  }) => {
    // Arrange
    await resetStaffUser();
    await page.goto(`/app/admin/users/${staffId}`);

    // Act
    await page.getByText("איש צוות", { exact: true }).first().click();

    // Assert
    await expect(page.getByText(MISSING_INSTITUTION_TEXT)).toBeVisible();
    const save = page.getByRole("button", { name: "שמירת תפקידים" });
    await expect(save).toBeDisabled();

    // Act
    await page.getByLabel("חיפוש מוסד").fill(nameA);
    await page
      .locator('[data-slot="staff-institutions-list"]')
      .getByText(nameA)
      .click();

    // Assert
    await expect(page.getByText(MISSING_INSTITUTION_TEXT)).toHaveCount(0);
    await expect(save).toBeEnabled();
    await save.click();
    await expect.poll(links).toEqual([institutionA]);
    await expect.poll(async () => canSee(studentA)).toBe(true);
  });
});
