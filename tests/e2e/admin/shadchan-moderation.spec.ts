import { expect, test, type Page } from "@playwright/test";

import { COMPLETE_IDENTITY_COLUMNS } from "../helpers/shadchan-form";
import {
  apiClientFor,
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";
import { serviceClient } from "../helpers/dedications";

/**
 * רשימת השדכנים של המנהל: הקפאה / ביטול הקפאה והסרת הרשאות. שדכן מוקפא
 * מאבד את כוחות השדכן במסד (is_shadchan / is_approved_shadchan) ובאפליקציה
 * (הודעת "מוקפא" באזורי השדכנים), וביטול ההקפאה מחזיר אותם.
 */
const LOAD = { timeout: 60_000 };
const FREEZE_REASON = "בדיקת הקפאה";
const REVOKE_REASON = "בדיקת הסרת הרשאות";

const admin = serviceClient();
let shadchan: SessionUser;
let shadchanName = "";

async function seedApprovedShadchan(): Promise<void> {
  shadchan = await createSessionUser({
    prefix: `moderation${Date.now()}`,
    roles: ["shadchan"],
  });
  const { data: profile } = await admin
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", shadchan.id)
    .single();
  shadchanName = `${profile?.first_name} ${profile?.last_name}`;
  const { error } = await admin.from("shadchanim_info").insert({
    user_id: shadchan.id,
    application_status: "approved",
    approved_at: new Date().toISOString(),
    // בראש הרשימה (ממוינת לפי תאריך הגשה)
    submitted_at: new Date(Date.now() + 60_000).toISOString(),
    bio: "שדכן לבדיקת הקפאה והסרת הרשאות",
    contact_phone: "0501234567",
    community: "בעלזא",
    synagogue_rabbi: "הרב בדיקה",
    ...COMPLETE_IDENTITY_COLUMNS,
  });
  if (error) throw new Error(`יצירת שדכן: ${error.message}`);
}

async function rowOf(page: Page) {
  await page.goto("/app/admin/shadchanim", {
    waitUntil: "domcontentloaded",
    ...LOAD,
  });
  const row = page.getByRole("row").filter({ hasText: shadchan.email });
  await expect(row).toBeVisible(LOAD);
  return row;
}

/** מצב התחלתי ידוע לכל בדיקה (גם בניסיון חוזר) */
async function setFrozen(isFrozen: boolean): Promise<void> {
  const { error } = await admin
    .from("shadchanim_info")
    .update({
      frozen_at: isFrozen ? new Date().toISOString() : null,
      frozen_reason: isFrozen ? FREEZE_REASON : null,
    })
    .eq("user_id", shadchan.id);
  if (error) throw new Error(`עדכון ההקפאה: ${error.message}`);
}

async function latestNotificationTitle(): Promise<string | null> {
  const { data } = await admin
    .from("notifications")
    .select("title")
    .eq("user_id", shadchan.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.title ?? null;
}

// רשימת השדכנים של המנהל כבדה (כל המשתמשים + סטטיסטיקות לכל שורה)
test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(seedApprovedShadchan);

test.afterAll(async () => {
  await admin.from("shadchanim_info").delete().eq("user_id", shadchan.id);
  await deleteSessionUsers([shadchan]);
});

test.describe("רשימת השדכנים - הקפאה והסרת הרשאות", () => {
  test("הקפאה מהרשימה: תג 'מוקפא', והמסד מפסיק לראות בו שדכן", async ({
    page,
  }) => {
    // Arrange
    await setFrozen(false);
    const row = await rowOf(page);

    // Act
    await row.getByRole("button", { name: `הקפאה: ${shadchanName}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill(FREEZE_REASON);
    await dialog.getByRole("button", { name: "הקפא" }).click();
    await expect(page.getByText("השדכן הוקפא")).toBeVisible(LOAD);

    // Assert - הרשימה כפי שהשרת מציג אותה אחרי השינוי
    const reloadedRow = await rowOf(page);
    await expect(reloadedRow.getByTestId("frozen-badge")).toHaveText("מוקפא");
    const { data: info } = await admin
      .from("shadchanim_info")
      .select("frozen_at, frozen_reason")
      .eq("user_id", shadchan.id)
      .single();
    expect(info?.frozen_at).toBeTruthy();
    expect(info?.frozen_reason).toBe(FREEZE_REASON);
    const session = await apiClientFor(shadchan);
    expect((await session.rpc("is_shadchan")).data).toBe(false);
    expect(
      (await session.rpc("is_approved_shadchan", { uid: shadchan.id })).data,
    ).toBe(false);
    expect(
      (await session.rpc("is_contactable_shadchan", { uid: shadchan.id })).data,
    ).toBe(false);
    // הערת שדכן נחסמת במדיניות ה-RLS (author_role = 'shadchan')
    const { data: anyStudent } = await admin
      .from("students")
      .select("id")
      .is("deleted_at", null)
      .limit(1)
      .single();
    const noteInsert = await session.from("student_notes").insert({
      student_id: anyStudent?.id,
      author_id: shadchan.id,
      author_role: "shadchan",
      body: "הערה של שדכן מוקפא",
    });
    expect(noteInsert.error?.code).toBe("42501");
    expect(await latestNotificationTitle()).toBe("חשבון השדכן שלך הוקפא");
  });

  test("שדכן מוקפא אינו יכול לבטל את ההקפאה בעצמו", async () => {
    // Arrange
    await setFrozen(true);
    const session = await apiClientFor(shadchan);

    // Act
    await session
      .from("shadchanim_info")
      .update({ frozen_at: null, frozen_reason: null })
      .eq("user_id", shadchan.id);

    // Assert
    const { data } = await admin
      .from("shadchanim_info")
      .select("frozen_at")
      .eq("user_id", shadchan.id)
      .single();
    expect(data?.frozen_at).toBeTruthy();
  });

  test("שדכן מוקפא רואה הודעת הקפאה באזורי השדכנים", async ({ browser }) => {
    // Arrange
    await setFrozen(true);
    const page = await openPageAs(browser, shadchan);

    try {
      // Act + Assert - העמוד הראשי
      await expect(page.getByTestId("shadchan-frozen-banner")).toBeVisible(
        LOAD,
      );

      // רשימת המיועדים
      await page.goto("/app/students");
      await expect(page.getByTestId("shadchan-frozen-notice")).toBeVisible(
        LOAD,
      );

      // לוח ההתאמות מפנה לעמוד ההסבר
      await page.goto("/app/canvas");
      await expect(page).toHaveURL(/\/app\/shadchan\/frozen$/, LOAD);
      await expect(page.getByTestId("shadchan-frozen-notice")).toBeVisible();

      // הפורום
      await page.goto("/app/forums");
      await expect(page.getByTestId("forum-access-notice")).toContainText(
        "מוקפא",
        LOAD,
      );

      // נתיבי ה-API של המנהל סגורים בפניו
      const response = await page.request.post(
        "/api/v1/admin/shadchanim/freeze",
        { data: { userId: shadchan.id, frozen: false } },
      );
      expect(response.status()).toBe(403);
    } finally {
      await page.context().close();
    }
  });

  test("ביטול הקפאה מחזיר את כוחות השדכן", async ({ page }) => {
    // Arrange
    await setFrozen(true);
    const row = await rowOf(page);

    // Act
    await row
      .getByRole("button", { name: `ביטול הקפאה: ${shadchanName}` })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "ביטול הקפאה" })
      .click();
    await expect(page.getByText("ההקפאה בוטלה")).toBeVisible(LOAD);

    // Assert
    const reloadedRow = await rowOf(page);
    await expect(
      reloadedRow.getByRole("button", { name: `הקפאה: ${shadchanName}` }),
    ).toBeVisible();
    await expect(reloadedRow.getByTestId("frozen-badge")).toHaveCount(0);
    const session = await apiClientFor(shadchan);
    expect((await session.rpc("is_shadchan")).data).toBe(true);
    expect(await latestNotificationTitle()).toBe("הקפאת חשבון השדכן שלך בוטלה");
  });

  test("הסרת הרשאות: התפקיד מוסר והבקשה מסומנת כנדחתה", async ({ page }) => {
    // Arrange
    const row = await rowOf(page);

    // Act
    await row
      .getByRole("button", { name: `הסרת הרשאות: ${shadchanName}` })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "הסר הרשאות" }),
    ).toBeDisabled();
    await dialog.getByRole("textbox").fill(REVOKE_REASON);
    await dialog.getByRole("button", { name: "הסר הרשאות" }).click();

    // Assert
    await expect(page.getByText("הרשאות השדכן הוסרו")).toBeVisible(LOAD);
    const { data: authUser } = await admin.auth.admin.getUserById(shadchan.id);
    expect(authUser.user?.app_metadata?.roles ?? []).not.toContain("shadchan");
    const { data: info } = await admin
      .from("shadchanim_info")
      .select("application_status, rejected_reason")
      .eq("user_id", shadchan.id)
      .single();
    expect(info?.application_status).toBe("rejected");
    expect(info?.rejected_reason).toBe(REVOKE_REASON);
    expect(await latestNotificationTitle()).toBe("הרשאות השדכן שלך הוסרו");
  });
});
