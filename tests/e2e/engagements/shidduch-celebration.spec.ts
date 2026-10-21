/**
 * Callers: Playwright `chromium` project (כל משתמש בהקשר נפרד משלו).
 * חגיגת שידוכים בכניסה ל-/app: שידוך חדש שנסגר - קונפטי והודעה, פעם אחת
 * בלבד; מי שלא נכנס יותר מ-30 יום - דיאלוג "ברוכים השבים". המתג
 * celebrations_enabled כבוי בשאר הבדיקות; כאן הוא נדלק ומוחזר בסוף.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  deleteEngagements,
  insertSystemEngagement,
  readCelebrationState,
  seedCelebrationState,
  setCelebrationsEnabled,
} from "../helpers/celebrations";
import {
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";

const LOAD = { timeout: 15_000 };
/** אחרי הטעינה: כמה זמן לחכות כדי לוודא שלא מופיעה חגיגה */
const QUIET_MS = 2_500;
const LONG_ABSENCE_DAYS = 40;

function celebrationToast(page: Page) {
  return page.getByText(/^מזל טוב! נסגר/);
}

function dashboardHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: /שלום/ });
}

async function expectNoCelebration(page: Page) {
  await expect(dashboardHeading(page)).toBeAttached(LOAD);
  await page.waitForTimeout(QUIET_MS);
  await expect(celebrationToast(page)).toHaveCount(0);
  await expect(page.getByTestId("celebration-dialog")).toHaveCount(0);
}

test.describe.serial("חגיגת שידוכים", () => {
  const users: SessionUser[] = [];
  const engagementIds: string[] = [];

  test.beforeAll(async () => {
    await setCelebrationsEnabled(true);
  });

  test.afterAll(async () => {
    await setCelebrationsEnabled(false);
    await deleteEngagements(engagementIds);
    await deleteSessionUsers(users);
  });

  test("שידוך חדש: הודעת מזל טוב בכניסה, ופעם אחת בלבד", async ({
    browser,
  }) => {
    // Arrange - המשתמש ראה חגיגה ונכנס אתמול; מאז נסגר שידוך
    const user = await createSessionUser({ prefix: "celebrate-new" });
    users.push(user);
    await seedCelebrationState(user.id, 1);
    engagementIds.push(await insertSystemEngagement("חגיגה"));
    const before = Date.now();

    // Act
    const page = await openPageAs(browser, user);

    try {
      // Assert - הודעה לא חוסמת, בלי דיאלוג
      await expect(celebrationToast(page)).toBeVisible(LOAD);
      await expect(page.getByTestId("celebration-dialog")).toHaveCount(0);
      await expect
        .poll(async () =>
          (await readCelebrationState(user.id))?.seenAt.getTime(),
        )
        .toBeGreaterThanOrEqual(before - 1_000);

      // Assert - כניסה נוספת: כבר נחגג
      await page.reload();
      await expectNoCelebration(page);
    } finally {
      await page.context().close();
    }
  });

  test("היעדרות ארוכה: דיאלוג ברוכים השבים, נסגר ולא חוזר", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSessionUser({ prefix: "celebrate-back" });
    users.push(user);
    await seedCelebrationState(user.id, LONG_ABSENCE_DAYS);
    engagementIds.push(await insertSystemEngagement("ברוכים השבים"));

    // Act
    const page = await openPageAs(browser, user);

    try {
      // Assert
      const dialog = page.getByTestId("celebration-dialog");
      await expect(dialog).toBeVisible(LOAD);
      await expect(
        dialog.getByRole("heading", { name: "ברוכים השבים!" }),
      ).toBeVisible();
      await expect(dialog).toContainText(/מאז ביקורך האחרון נסגר.*מזל טוב!/);
      await expect(celebrationToast(page)).toHaveCount(0);

      // Act - סגירה
      await dialog.getByRole("button", { name: "אמן, בשורות טובות!" }).click();
      await expect(dialog).toHaveCount(0);

      // Assert - נחגג: הכניסה הבאה שקטה, והכניסה האחרונה עודכנה
      await page.reload();
      await expectNoCelebration(page);
      const state = await readCelebrationState(user.id);
      expect(state?.lastEntryAt.getTime()).toBeGreaterThan(
        Date.now() - 60 * 60 * 1000,
      );
    } finally {
      await page.context().close();
    }
  });

  test("בלי שידוך חדש מאז החגיגה האחרונה - אין חגיגה", async ({ browser }) => {
    // Arrange - ראה חגיגה עכשיו; מאז לא נסגר שידוך
    const user = await createSessionUser({ prefix: "celebrate-none" });
    users.push(user);
    await seedCelebrationState(user.id, 0);

    // Act
    const page = await openPageAs(browser, user);

    try {
      // Assert
      await expectNoCelebration(page);
    } finally {
      await page.context().close();
    }
  });
});
