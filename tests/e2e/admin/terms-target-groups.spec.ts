/**
 * Callers: Playwright `chromium-admin` project (המנהל מהסשן המשותף; כל משתמש
 * רגיל בהקשר נפרד).
 * תקנון מעודכן לקבוצות: המנהל מפרסם גרסה לשדכנים בלבד - שדכן נחסם עד אישור,
 * משתמש רגיל לא נחסם. משתמש שלא אישר גרסה קודמת (לכולם) נחסם עליה ויכול
 * לאשר אותה, למרות שהיא כבר לא הנוכחית. המתג terms_gate_enabled נדלק ומוחזר.
 */
import { expect, test, type Page } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";
import {
  createSessionUser,
  currentTermsVersion,
  deleteSessionUsers,
  openPageAs,
  seedTermsAcceptance,
  setTermsGateEnabled,
  type SessionUser,
} from "../helpers/session-user";

const LOAD = { timeout: 15_000 };
const TEST_TIMEOUT_MS = 120_000;
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

function dashboardHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: /שלום/ });
}

async function acceptInDialog(page: Page) {
  const dialog = page.getByTestId("terms-gate-dialog");
  await dialog.getByRole("checkbox", CHECKBOX).check();
  await dialog.getByRole("button", { name: "אישור והמשך" }).click();
  await expect(dialog).toHaveCount(0, LOAD);
}

test.describe.serial("תקנון מעודכן לקבוצות משתמשים", () => {
  const created: SessionUser[] = [];

  test.beforeAll(async () => {
    await setTermsGateEnabled(true);
  });

  test.afterAll(async () => {
    await setTermsGateEnabled(false);
    await deleteSessionUsers(created);
  });

  test("גרסה לשדכנים בלבד חוסמת שדכן ולא משתמש רגיל", async ({
    page,
    browser,
  }) => {
    // ארבעה הקשרי דפדפן ברצף - יותר מברירת המחדל של 30 שניות
    test.setTimeout(TEST_TIMEOUT_MS);
    // Arrange - כולם אישרו את הגרסה הנוכחית, חוץ מ"מאחר" אחד
    const version = await currentTermsVersion();
    const shadchan = await createSessionUser({
      prefix: "terms-target-shadchan",
      roles: ["shadchan"],
    });
    const regular = await createSessionUser({ prefix: "terms-target-user" });
    const lagging = await createSessionUser({ prefix: "terms-target-lag" });
    created.push(shadchan, regular, lagging);
    await seedTermsAcceptance(shadchan.id, version);
    await seedTermsAcceptance(regular.id, version);
    await seedTermsAcceptance(await adminUserId(), version);

    await page.goto("/app/admin/settings/terms-of-service");
    const panel = page.getByTestId("terms-version-panel");
    await expect(panel.getByTestId("terms-version")).toHaveText(
      String(version),
      LOAD,
    );
    await expect(
      panel.getByRole("checkbox", { name: "כל המשתמשים" }),
    ).toBeChecked();

    // Act - בחירת שדכנים ופרסום
    await panel.getByRole("checkbox", { name: "שדכנים" }).check();
    await expect(
      panel.getByRole("checkbox", { name: "כל המשתמשים" }),
    ).not.toBeChecked();
    await panel
      .getByRole("button", { name: "פרסום גרסה חדשה – לחייב אישור מחדש" })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "פרסום גרסה חדשה של התקנון",
    });
    await expect(confirm).toContainText("המשתמשים בקבוצות: שדכנים");
    await confirm.getByRole("button", { name: "פרסום ושליחה לאישור" }).click();

    // Assert - גרסה חדשה, ובהיסטוריה עם קבוצת היעד
    await expect(panel.getByTestId("terms-version")).toHaveText(
      String(version + 1),
      LOAD,
    );
    const latestRow = panel.getByTestId("terms-version-history-row").first();
    await expect(latestRow).toContainText(`גרסה ${version + 1}`, LOAD);
    await expect(latestRow).toContainText("שדכנים");
    const { data: stored } = await serviceClient()
      .from("terms_versions")
      .select("target_groups")
      .eq("version", version + 1)
      .single();
    expect(stored?.target_groups).toEqual(["shadchan"]);

    // Assert - משתמש רגיל לא נחסם
    const regularPage = await openPageAs(browser, regular);
    try {
      await expect(dashboardHeading(regularPage)).toBeAttached(LOAD);
      await expect(regularPage.getByTestId("terms-gate-dialog")).toHaveCount(0);
    } finally {
      await regularPage.context().close();
    }

    // Assert - שדכן נחסם עד שהוא מאשר את הגרסה החדשה
    const shadchanPage = await openPageAs(browser, shadchan);
    try {
      await expect(shadchanPage.getByTestId("terms-gate-dialog")).toBeVisible(
        LOAD,
      );
      await acceptInDialog(shadchanPage);
      expect(await acceptedVersions(shadchan.id)).toContain(version + 1);
    } finally {
      await shadchanPage.context().close();
    }

    // Assert - מי שלא אישר את הגרסה הקודמת (לכולם) נחסם עליה, ויכול לאשר
    const laggingPage = await openPageAs(browser, lagging);
    try {
      await expect(laggingPage.getByTestId("terms-gate-dialog")).toBeVisible(
        LOAD,
      );
      await acceptInDialog(laggingPage);
      // הגרסה הגבוהה שמיועדת לכולם (בריצה חוזרת - אולי מתחת ל-version)
      const laggingAccepted = await acceptedVersions(lagging.id);
      expect(laggingAccepted).toHaveLength(1);
      expect(laggingAccepted[0]).toBeLessThanOrEqual(version);
      await laggingPage.reload();
      await expect(dashboardHeading(laggingPage)).toBeAttached(LOAD);
      await expect(laggingPage.getByTestId("terms-gate-dialog")).toHaveCount(0);
    } finally {
      await laggingPage.context().close();
    }
  });
});
