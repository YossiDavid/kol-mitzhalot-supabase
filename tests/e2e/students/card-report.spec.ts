import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
  pageAs,
} from "../chats/context-fixtures";
import { createUserSessionClient } from "../forums/forum-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * דיווח על כרטיס (פריט 26): הדיאלוג, הוולידציה, השמירה, ההתראה לכל המנהלים,
 * חסימות (בעלים / אין גישה / כפילות / מכסה יומית) ו-RLS. משתמש הבדיקה הוא
 * שדכן; ההורה עם ההצעה נכנס בהקשר דפדפן נפרד.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const RUN = `${Date.now()}`.slice(-8);
const DAILY_LIMIT = 10;

let admin: SupabaseClient;
let shadchanId: string;
let managerId: string;
let parentId: string;
let managerCardId: string;
let parentCardId: string;
let ownCardId: string;
let strangerId: string;
const cardIds: string[] = [];
const shidduchIds: string[] = [];

const reportUrl = (studentId: string) => `/api/v1/students/${studentId}/report`;

async function openReportDialog(page: Page) {
  await page.getByRole("button", { name: "עוד פעולות" }).click();
  await page.getByRole("menuitem", { name: "דיווח על הכרטיס" }).click();
  return page.getByTestId("report-card-dialog");
}

async function reportsOf(reporterId: string, studentId: string) {
  const { data } = await admin
    .from("card_reports")
    .select("id, reason, details, status")
    .eq("reporter_id", reporterId)
    .eq("student_id", studentId);
  return data ?? [];
}

async function adminUserIds(): Promise<string[]> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? [])
    .filter((user) => (user.app_metadata?.roles ?? []).includes("admin"))
    .map((user) => user.id);
}

async function clearReports() {
  await admin.from("card_reports").delete().in("student_id", cardIds);
}

test.describe("דיווח על כרטיס", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    managerId = await ensureCardManagerId(admin);
    parentId = await ensureSecondParentId(admin);

    managerCardId = await createCard(admin, {
      userId: managerId,
      gender: "female",
      firstName: "מדווחת",
      lastName: `דיווח${RUN}`,
    });
    parentCardId = await createCard(admin, {
      userId: parentId,
      gender: "male",
      firstName: "הורה",
      lastName: `הורה${RUN}`,
    });
    ownCardId = await createCard(admin, {
      userId: shadchanId,
      gender: "female",
      firstName: "שלי",
      lastName: `שלי${RUN}`,
    });
    cardIds.push(managerCardId, parentCardId, ownCardId);

    // הצעה ששלחה הצד של manager אל parent: ההורה רואה את כרטיס manager
    shidduchIds.push(
      await insertProposal(admin, {
        groomId: parentCardId,
        brideId: managerCardId,
        shadchanId,
      }),
    );

    const { data: stranger, error } = await admin.auth.admin.createUser({
      email: `report-stranger-${RUN}@kol-mitzhalot.test`,
      phone: `+9725${RUN}`,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { firstName: "זר", lastName: "בלי הצעה" },
    });
    expect(error).toBeNull();
    strangerId = stranger.user!.id;
  });

  test.afterAll(async () => {
    const { data: reports } = await admin
      .from("card_reports")
      .select("id")
      .in("student_id", cardIds);
    const reportIds = (reports ?? []).map((row) => row.id as string);
    if (reportIds.length > 0) {
      await admin.from("notifications").delete().in("related_id", reportIds);
    }
    await clearReports();
    if (shidduchIds.length > 0) {
      await admin.from("shidduchim").delete().in("id", shidduchIds);
    }
    await admin.from("students").delete().in("id", cardIds);
    if (strangerId) await admin.auth.admin.deleteUser(strangerId);
  });

  test("שדכן מדווח: ולידציה בדיאלוג, שמירה, והתראה לכל המנהלים", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${managerCardId}`);
    const dialog = await openReportDialog(page);

    // Act + Assert - בלי סיבה
    await dialog.getByRole("button", { name: "שליחת דיווח" }).click();
    await expect(dialog.getByTestId("report-card-error")).toHaveText(
      "יש לבחור סיבת דיווח",
    );

    // Act + Assert - "אחר" בלי פירוט
    await dialog.getByLabel("סיבת הדיווח").selectOption({ label: "אחר" });
    await dialog.getByRole("button", { name: "שליחת דיווח" }).click();
    await expect(dialog.getByTestId("report-card-error")).toContainText(
      "יש לפרט",
    );
    expect(await reportsOf(shadchanId, managerCardId)).toHaveLength(0);

    // Act - דיווח תקין
    await dialog
      .getByLabel("סיבת הדיווח")
      .selectOption({ label: "פרטים שגויים" });
    await dialog.getByLabel("פירוט").fill("הגיל אינו נכון");
    await dialog.getByRole("button", { name: "שליחת דיווח" }).click();

    // Assert
    await expect(dialog).toBeHidden();
    const stored = await reportsOf(shadchanId, managerCardId);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      reason: "wrong_details",
      details: "הגיל אינו נכון",
      status: "open",
    });
    const adminIds = await adminUserIds();
    expect(adminIds.length).toBeGreaterThan(0);
    const { data: notifications } = await admin
      .from("notifications")
      .select("user_id, type, link")
      .eq("related_id", stored[0].id);
    expect(notifications?.map((row) => row.user_id).sort()).toEqual(
      [...adminIds].sort(),
    );
    expect(notifications?.[0]).toMatchObject({
      type: "card_report",
      link: "/app/admin/card-reports",
    });
  });

  test("דיווח כפול פתוח על אותו כרטיס נדחה", async ({ page }) => {
    // Act
    const response = await page.request.post(reportUrl(managerCardId), {
      data: { reason: "duplicate_card" },
    });

    // Assert
    expect(response.status()).toBe(409);
    expect(await reportsOf(shadchanId, managerCardId)).toHaveLength(1);
  });

  test("הנתיב דוחה סיבה לא מוכרת, 'אחר' בלי פירוט ופירוט ארוך מדי", async ({
    page,
  }) => {
    // Act
    const unknown = await page.request.post(reportUrl(managerCardId), {
      data: { reason: "bogus" },
    });
    const otherNoDetails = await page.request.post(reportUrl(managerCardId), {
      data: { reason: "other", details: "   " },
    });
    const tooLong = await page.request.post(reportUrl(managerCardId), {
      data: { reason: "wrong_details", details: "א".repeat(4001) },
    });

    // Assert
    expect(unknown.status()).toBe(400);
    expect(otherNoDetails.status()).toBe(400);
    expect(tooLong.status()).toBe(400);
  });

  test("בעל הכרטיס אינו רואה 'דיווח על הכרטיס', והפונקציה דוחה אותו", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${ownCardId}`);
    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await expect(
      page.getByRole("menuitem", { name: "שיתוף הכרטיס" }),
    ).toBeVisible();

    // Assert - אין פריט בתפריט
    await expect(
      page.getByRole("menuitem", { name: "דיווח על הכרטיס" }),
    ).toHaveCount(0);

    // Act - ניסיון ישיר
    const response = await page.request.post(reportUrl(ownCardId), {
      data: { reason: "wrong_details" },
    });

    // Assert
    expect(response.status()).toBe(403);
    expect(await reportsOf(shadchanId, ownCardId)).toHaveLength(0);
  });

  test("שדכן אינו רואה בקרת השהיה, והנתיב סוגר בפניו", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${managerCardId}`);
    await page.getByRole("button", { name: "עוד פעולות" }).click();

    // Assert
    await expect(
      page.getByRole("menuitem", { name: "השהיית הכרטיס" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("card-admin-paused-banner")).toHaveCount(0);
    const response = await page.request.patch(
      `/api/v1/students/${managerCardId}/admin-pause`,
      { data: { paused: true } },
    );
    expect(response.status()).toBe(403);
  });

  test("הורה עם הצעה מדווח על הכרטיס שהוצע לו", async ({ browser }) => {
    // Arrange
    const parentPage = await pageAs(
      browser,
      admin,
      SECOND_PARENT_EMAIL,
      `/app/students/${managerCardId}`,
    );
    try {
      const dialog = await openReportDialog(parentPage);

      // Act
      await dialog
        .getByLabel("סיבת הדיווח")
        .selectOption({ label: "כרטיס כפול" });
      await dialog.getByRole("button", { name: "שליחת דיווח" }).click();

      // Assert
      await expect(dialog).toBeHidden();
      const stored = await reportsOf(parentId, managerCardId);
      expect(stored).toHaveLength(1);
      expect(stored[0].reason).toBe("duplicate_card");
    } finally {
      await parentPage.context().close();
    }
  });

  test("משתמש בלי גישה לכרטיס נדחה במסד, ואנונימי בנתיב", async ({
    playwright,
    baseURL,
  }) => {
    // Arrange
    const stranger = await createUserSessionClient(
      admin,
      `report-stranger-${RUN}@kol-mitzhalot.test`,
    );
    const anonymous = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });

    // Act
    const { data: result } = await stranger.rpc("report_student_card", {
      p_student_id: managerCardId,
      p_reason: "wrong_details",
      p_details: "",
    });
    const anonymousResponse = await anonymous.post(reportUrl(managerCardId), {
      data: { reason: "wrong_details" },
    });

    // Assert
    expect(result).toBe("card_not_visible");
    expect(anonymousResponse.status()).toBe(401);
    expect(await reportsOf(strangerId, managerCardId)).toHaveLength(0);
    await anonymous.dispose();
  });

  test("מדווח אחד אינו קורא דיווחים של אחרים (RLS)", async () => {
    // Arrange
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);
    const parent = await clientAs(admin, SECOND_PARENT_EMAIL);

    // Act
    const asShadchan = await shadchan.from("card_reports").select("id");
    const asParent = await parent.from("card_reports").select("id");
    const forged = await shadchan.from("card_reports").insert({
      student_id: managerCardId,
      reporter_id: shadchanId,
      reason: "wrong_details",
    });

    // Assert
    expect(asShadchan.data ?? []).toHaveLength(0);
    expect(asParent.data ?? []).toHaveLength(0);
    expect(forged.error).not.toBeNull();
  });

  test("מכסה יומית: אחרי 10 דיווחים הדיווח הבא נדחה", async ({ page }) => {
    // Arrange - 10 דיווחים שטופלו (לא נתקלים באינדקס הפתוח היחיד)
    await clearReports();
    const rows = Array.from({ length: DAILY_LIMIT }, () => ({
      student_id: managerCardId,
      reporter_id: shadchanId,
      reason: "wrong_details",
      status: "handled",
    }));
    const { error } = await admin.from("card_reports").insert(rows);
    expect(error).toBeNull();

    // Act
    const response = await page.request.post(reportUrl(managerCardId), {
      data: { reason: "inappropriate_content" },
    });

    // Assert
    expect(response.status()).toBe(429);
    expect(
      (await reportsOf(shadchanId, managerCardId)).filter(
        (row) => row.status === "open",
      ),
    ).toHaveLength(0);
  });

  test("גולש אנונימי בכרטיס הציבורי: אין כפתור דיווח ואין בקרות מנהל", async ({
    browser,
  }) => {
    // Arrange
    const context = await browser.newContext({
      locale: "he-IL",
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    // Act
    await page.goto(`/app/students/${managerCardId}`);
    await expect(page.locator("h1")).toContainText(`דיווח${RUN}`);

    // Assert
    await expect(page.getByText("דיווח על הכרטיס")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "עוד פעולות" })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("card-admin-paused-banner")).toHaveCount(0);
    await context.close();
  });
});
