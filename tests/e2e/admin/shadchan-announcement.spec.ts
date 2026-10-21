import { expect, test } from "@playwright/test";

import { SHADCHAN_FEE_NOTICE } from "../../../features/admin/lib/shadchan-announcement";
import { COMPLETE_IDENTITY_COLUMNS } from "../helpers/shadchan-form";
import {
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";
import { serviceClient } from "../helpers/dedications";

/**
 * הודעת הנהלה לכל השדכנים מרשימת השדכנים: דיאלוג ממולא מראש בהודעת ההפרשה
 * למערכת, אישור לפני שליחה, התראה לכל שדכן מאושר שאינו מוקפא ורישום ביומן.
 * וגם: שדכן חדש שמאושר מקבל את הודעת ההפרשה בהתראה.
 */
const LOAD = { timeout: 60_000 };
const ANNOUNCEMENT_TYPE = "admin_announcement";
const TITLE = `הודעת בדיקה לשדכנים ${Date.now()}`;

const admin = serviceClient();
let activeShadchan: SessionUser;
let frozenShadchan: SessionUser;
let pendingApplicant: SessionUser;

async function seedShadchanInfo(
  user: SessionUser,
  overrides: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("shadchanim_info").insert({
    user_id: user.id,
    submitted_at: new Date().toISOString(),
    bio: "שדכן לבדיקת הודעת הנהלה",
    contact_phone: "0501234567",
    community: "בעלזא",
    synagogue_rabbi: "הרב בדיקה",
    ...COMPLETE_IDENTITY_COLUMNS,
    ...overrides,
  });
  if (error) throw new Error(`יצירת שדכן: ${error.message}`);
}

async function announcementTitles(userId: string): Promise<string[]> {
  const { data } = await admin
    .from("notifications")
    .select("title")
    .eq("user_id", userId)
    .eq("type", ANNOUNCEMENT_TYPE);
  return (data ?? []).map((row) => row.title as string);
}

// רשימת השדכנים של המנהל כבדה (כל המשתמשים + סטטיסטיקות לכל שורה)
test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async () => {
  const prefix = `announce${Date.now()}`;
  activeShadchan = await createSessionUser({ prefix, roles: ["shadchan"] });
  frozenShadchan = await createSessionUser({ prefix, roles: ["shadchan"] });
  pendingApplicant = await createSessionUser({ prefix });
  const now = new Date().toISOString();
  await seedShadchanInfo(activeShadchan, {
    application_status: "approved",
    approved_at: now,
  });
  await seedShadchanInfo(frozenShadchan, {
    application_status: "approved",
    approved_at: now,
    frozen_at: now,
  });
  await seedShadchanInfo(pendingApplicant, { application_status: "pending" });
});

test.afterAll(async () => {
  await admin.from("notifications").delete().eq("title", TITLE);
  await admin
    .from("activity_log")
    .delete()
    .eq("action", "announcement.shadchanim")
    .eq("summary", TITLE);
  const users = [activeShadchan, frozenShadchan, pendingApplicant];
  await admin
    .from("shadchanim_info")
    .delete()
    .in(
      "user_id",
      users.map((u) => u.id),
    );
  await deleteSessionUsers(users);
});

test.describe("הודעה לכל השדכנים", () => {
  test("הדיאלוג ממולא בהודעת ההפרשה, ושליחה אחרי אישור מגיעה רק לשדכנים פעילים", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/admin/shadchanim", {
      waitUntil: "domcontentloaded",
      ...LOAD,
    });
    await page
      .getByRole("button", { name: "שליחת הודעה לכל השדכנים" })
      .click(LOAD);
    const editor = page.getByRole("dialog");
    const titleField = editor.getByLabel("כותרת");
    await expect(titleField).toHaveValue(SHADCHAN_FEE_NOTICE.title);
    await expect(editor.getByLabel("תוכן ההודעה")).toHaveValue(
      SHADCHAN_FEE_NOTICE.body,
    );

    // Act
    await titleField.fill(TITLE);
    await editor.getByRole("button", { name: "המשך לשליחה" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText("לשלוח את ההודעה לכל השדכנים?");
    await confirm.getByRole("button", { name: "שליחה" }).click();

    // Assert
    await expect(page.getByText(/ההודעה נשלחה ל-\d+ שדכנים/)).toBeVisible(LOAD);
    expect(await announcementTitles(activeShadchan.id)).toContain(TITLE);
    expect(await announcementTitles(frozenShadchan.id)).not.toContain(TITLE);
    expect(await announcementTitles(pendingApplicant.id)).not.toContain(TITLE);
    const { data: bodyRow } = await admin
      .from("notifications")
      .select("body")
      .eq("user_id", activeShadchan.id)
      .eq("title", TITLE)
      .single();
    expect(bodyRow?.body).toBe(SHADCHAN_FEE_NOTICE.body);
    const { data: logRow } = await admin
      .from("activity_log")
      .select("entity_type, details")
      .eq("action", "announcement.shadchanim")
      .eq("summary", TITLE)
      .single();
    expect(logRow?.entity_type).toBe("announcement");
    expect(Number(logRow?.details?.recipients)).toBeGreaterThan(0);
  });

  test("ביטול באישור מחזיר לעריכה בלי לשלוח", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/shadchanim", {
      waitUntil: "domcontentloaded",
      ...LOAD,
    });
    await page
      .getByRole("button", { name: "שליחת הודעה לכל השדכנים" })
      .click(LOAD);
    await page.getByRole("dialog").getByLabel("כותרת").fill(`${TITLE} בוטל`);
    await page.getByRole("button", { name: "המשך לשליחה" }).click();

    // Act
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "ביטול" })
      .click();

    // Assert
    await expect(page.getByRole("dialog").getByLabel("כותרת")).toHaveValue(
      `${TITLE} בוטל`,
    );
    expect(await announcementTitles(activeShadchan.id)).not.toContain(
      `${TITLE} בוטל`,
    );
  });

  test("הנתיב למנהל בלבד", async ({ browser }) => {
    // Arrange
    const shadchanPage = await openPageAs(browser, activeShadchan);

    // Act
    const response = await shadchanPage.request.post(
      "/api/v1/admin/shadchanim/announce",
      { data: { title: `${TITLE} חסום`, body: "לא אמור להישלח" } },
    );

    // Assert
    expect(response.status()).toBe(403);
    expect(await announcementTitles(activeShadchan.id)).not.toContain(
      `${TITLE} חסום`,
    );
    await shadchanPage.context().close();
  });

  test("אישור שדכן חדש שולח לו את הודעת ההפרשה למערכת", async ({ page }) => {
    // Act
    const response = await page.request.post(
      "/api/v1/admin/shadchanim/approve",
      { data: { userId: pendingApplicant.id } },
    );

    // Assert
    expect(response.status(), await response.text()).toBe(200);
    expect(await announcementTitles(pendingApplicant.id)).toEqual([
      SHADCHAN_FEE_NOTICE.title,
    ]);
  });
});
