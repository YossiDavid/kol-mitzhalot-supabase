/**
 * Callers: Playwright `chromium-admin` project (המנהל מהסשן המשותף; כל משתמש
 * רגיל בהקשר נפרד).
 * חסימת אישור התקנון: /app חסום עד אישור, הדיאלוג לא נסגר בלי אישור, מי שאישר
 * בטופס ההרשמה לא נחסם, ופרסום גרסה חדשה בידי המנהל חוסם שוב את כולם.
 * המתג terms_gate_enabled כבוי בשאר הבדיקות; כאן הוא נדלק ומוחזר בסוף.
 */
import { expect, test, type Page } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";
import {
  apiClientFor,
  createSessionUser,
  currentTermsVersion,
  deleteSessionUsers,
  openPageAs,
  seedTermsAcceptance,
  setTermsGateEnabled,
  type SessionUser,
} from "../helpers/session-user";

const LOAD = { timeout: 15_000 };
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const CHECKBOX = { name: "קראתי ואני מסכים/ה לתקנון" } as const;

async function adminUserId(): Promise<string> {
  const { data } = await serviceClient().auth.admin.listUsers({
    perPage: 1000,
  });
  const admin = data?.users.find((user) => user.email === ADMIN_EMAIL);
  if (!admin) throw new Error("משתמש המנהל לא נמצא");
  return admin.id;
}

async function acceptedVersions(userId: string): Promise<number[]> {
  const { data } = await serviceClient()
    .from("terms_acceptances")
    .select("version")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.version as number);
}

/** כותרת הדשבורד ("שלום, ...") - מוצגת רק כשהדף עצמו נטען, בלי חסימה */
function dashboardHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: /שלום/ });
}

async function acceptInDialog(page: Page) {
  const dialog = page.getByTestId("terms-gate-dialog");
  await dialog.getByRole("checkbox", CHECKBOX).check();
  await dialog.getByRole("button", { name: "אישור והמשך" }).click();
  await expect(dialog).toHaveCount(0, LOAD);
}

test.describe.serial("חסימת אישור התקנון", () => {
  const created: SessionUser[] = [];

  test.beforeAll(async () => {
    await setTermsGateEnabled(true);
  });

  test.afterAll(async () => {
    await setTermsGateEnabled(false);
    await deleteSessionUsers(created);
  });

  test("משתמש שלא אישר נחסם עד שהוא מסמן ומאשר; Esc לא סוגר", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSessionUser({ prefix: "terms-new" });
    created.push(user);
    const version = await currentTermsVersion();
    const page = await openPageAs(browser, user);

    try {
      // Assert - הדיאלוג מחליף את הדף, והאישור כבוי עד הסימון
      const dialog = page.getByTestId("terms-gate-dialog");
      await expect(dialog).toBeVisible(LOAD);
      await expect(
        dialog.getByRole("link", { name: /פתיחת התקנון/ }),
      ).toHaveAttribute("href", "/legal/terms-of-service");
      const accept = dialog.getByRole("button", { name: "אישור והמשך" });
      await expect(accept).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();

      // ניווט לדף אחר ב-/app עדיין חסום
      await page.goto("/app/settings");
      await expect(page.getByTestId("terms-gate-dialog")).toBeVisible(LOAD);

      // Act
      await acceptInDialog(page);

      // Assert
      expect(await acceptedVersions(user.id)).toContain(version);
      await page.reload();
      await expect(page.getByTestId("terms-gate-dialog")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("מי שאישר בטופס ההרשמה את הגרסה הנוכחית לא נחסם, והאישור נרשם", async ({
    browser,
  }) => {
    // Arrange
    const version = await currentTermsVersion();
    const user = await createSessionUser({
      prefix: "terms-signup",
      metadata: { terms_accepted_version: version },
    });
    created.push(user);

    // Act
    const page = await openPageAs(browser, user);

    try {
      // Assert
      await expect(dashboardHeading(page)).toBeAttached(LOAD);
      await expect(page.getByTestId("terms-gate-dialog")).toHaveCount(0);
      expect(await acceptedVersions(user.id)).toContain(version);
    } finally {
      await page.context().close();
    }
  });

  test("RLS: אי אפשר לאשר גרסה עתידית או בשם משתמש אחר", async () => {
    // Arrange
    const [user, other] = [
      await createSessionUser({ prefix: "terms-rls" }),
      await createSessionUser({ prefix: "terms-rls-other" }),
    ];
    created.push(user, other);
    const version = await currentTermsVersion();
    const client = await apiClientFor(user);

    // Act
    const future = await client
      .from("terms_acceptances")
      .insert({ user_id: user.id, version: version + 1 });
    const forOther = await client
      .from("terms_acceptances")
      .insert({ user_id: other.id, version });
    const own = await client
      .from("terms_acceptances")
      .insert({ user_id: user.id, version });
    const readOther = await client
      .from("terms_acceptances")
      .select("user_id")
      .eq("user_id", other.id);
    const publish = await client.rpc("publish_system_content_version", {
      p_key: "terms-of-service",
    });

    // Assert
    expect(future.error).not.toBeNull();
    expect(forOther.error).not.toBeNull();
    expect(own.error).toBeNull();
    expect(readOther.data ?? []).toHaveLength(0);
    expect(publish.error).not.toBeNull();
    expect(await currentTermsVersion()).toBe(version);
  });

  test("שמירה רגילה לא מחייבת אישור מחדש; פרסום גרסה חדשה חוסם שוב", async ({
    page,
    browser,
  }) => {
    // Arrange - המשתמש והמנהל כבר אישרו את הגרסה הנוכחית
    const version = await currentTermsVersion();
    const user = await createSessionUser({ prefix: "terms-republish" });
    created.push(user);
    await seedTermsAcceptance(user.id, version);
    await seedTermsAcceptance(await adminUserId(), version);

    await page.goto("/app/admin/settings/terms-of-service");
    const panel = page.getByTestId("terms-version-panel");
    await expect(panel.getByTestId("terms-version")).toHaveText(
      String(version),
      LOAD,
    );

    // Act - שמירה רגילה (תיקון ניסוח)
    await page.getByRole("button", { name: "שמור", exact: true }).click();
    await expect(page.getByText("התוכן נשמר בהצלחה")).toBeVisible(LOAD);

    // Assert - הגרסה לא השתנתה, והמשתמש לא נחסם
    expect(await currentTermsVersion()).toBe(version);
    const userPage = await openPageAs(browser, user);
    try {
      await expect(dashboardHeading(userPage)).toBeAttached(LOAD);
      await expect(userPage.getByTestId("terms-gate-dialog")).toHaveCount(0);

      // Act - פרסום גרסה חדשה
      await panel
        .getByRole("button", { name: "פרסום גרסה חדשה – לחייב אישור מחדש" })
        .click();
      await page.getByRole("button", { name: "פרסום ושליחה לאישור" }).click();

      // Assert
      await expect(panel.getByTestId("terms-version")).toHaveText(
        String(version + 1),
        LOAD,
      );
      await userPage.reload();
      await expect(userPage.getByTestId("terms-gate-dialog")).toBeVisible(LOAD);

      await acceptInDialog(userPage);
      expect(await acceptedVersions(user.id)).toContain(version + 1);
    } finally {
      await userPage.context().close();
    }
  });
});
