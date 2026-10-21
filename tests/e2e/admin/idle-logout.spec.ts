/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * התנתקות אוטומטית אחרי חוסר פעילות: המנהל קובע את הזמן בהגדרות המערכת;
 * דקה לפני (בזמן קצר - חצי ממנו) מוצג "עדיין כאן?", "להישאר מחובר" מאפס,
 * ובסוף הספירה המשתמש מנותק ומגיע להתחברות עם הודעה. הזמן מזויף (page.clock).
 *
 * הניתוק מבטל את הסשן בשרת, ולכן הוא נבדק על משתמשים זמניים בהקשר נפרד -
 * לא על הסשן המשותף של המנהל (storageState) שבשאר הבדיקות.
 */
import { expect, test, type Page } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";
import {
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";

const SETTINGS_PATH = "/app/admin/settings";
const KEY = "idle_logout_minutes";
const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 30_000 };

/** בזמן של דקה האזהרה מוצגת בחצי השני שלה (30 שניות לפני הניתוק) */
const TEST_TIMEOUT_MINUTES = 1;
const BEFORE_WARNING_MS = 20_000;
const INTO_WARNING_MS = 35_000;
const PAST_TIMEOUT_MS = 30_000;

async function setIdleMinutes(minutes: number): Promise<void> {
  const { error } = await serviceClient()
    .from("system_settings")
    .upsert({ key: KEY, text_value: String(minutes) });
  if (error) throw new Error(`עדכון זמן ההתנתקות נכשל: ${error.message}`);
}

const idleDialog = (page: Page) => page.getByTestId("idle-logout-dialog");

/** טעינה מחדש עם שעון מזויף: השומר מתחיל לספור מטעינת הדף */
async function openWithFakeClock(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto("/app");
  await expect(page.getByTitle("תפריט משתמש")).toBeVisible(LOAD);
}

test.describe("התנתקות אוטומטית אחרי חוסר פעילות", () => {
  let previous: string | null = null;
  const users: SessionUser[] = [];

  test.beforeAll(async () => {
    const { data } = await serviceClient()
      .from("system_settings")
      .select("text_value")
      .eq("key", KEY)
      .maybeSingle();
    previous = data?.text_value ?? null;
  });

  test.afterAll(async () => {
    const service = serviceClient();
    if (previous) {
      await service
        .from("system_settings")
        .upsert({ key: KEY, text_value: previous });
    } else {
      await service.from("system_settings").delete().eq("key", KEY);
    }
    await deleteSessionUsers(users);
  });

  async function loggedInPage(browser: Parameters<typeof openPageAs>[0]) {
    const user = await createSessionUser({ prefix: "idle-logout" });
    users.push(user);
    return openPageAs(browser, user);
  }

  test("המנהל שומר זמן התנתקות מהבחירה המהירה ומספר חופשי", async ({
    page,
  }) => {
    // Arrange
    await setIdleMinutes(30);
    await page.setViewportSize(DESKTOP);
    await page.goto(SETTINGS_PATH);
    const setting = page.getByTestId("idle-logout-setting");
    const input = setting.locator("#idle-logout-minutes-input");
    await expect(input).toHaveValue("30", LOAD);

    // Act: בחירה מהירה "שעה"
    await setting.getByRole("button", { name: "שעה", exact: true }).click();
    await setting.getByRole("button", { name: "שמירת זמן ההתנתקות" }).click();

    // Assert
    await expect(page.getByText("זמן ההתנתקות נשמר")).toBeVisible(LOAD);
    await expect
      .poll(async () => {
        const { data } = await serviceClient()
          .from("system_settings")
          .select("text_value")
          .eq("key", KEY)
          .maybeSingle();
        return data?.text_value;
      })
      .toBe("60");

    // Act: ערך לא תקין נדחה בטופס
    await input.fill("-5");
    await setting.getByRole("button", { name: "שמירת זמן ההתנתקות" }).click();
    await expect(setting.getByRole("alert")).toBeVisible();

    // Act: כיבוי
    await setting.getByRole("button", { name: "כבוי", exact: true }).click();
    await setting.getByRole("button", { name: "שמירת זמן ההתנתקות" }).click();
    await expect(page.getByText("ההתנתקות האוטומטית כובתה")).toBeVisible(LOAD);

    // Assert: נשמר גם אחרי טעינה מחדש
    await page.reload();
    await expect(input).toHaveValue("0", LOAD);
  });

  test("אזהרה עם ספירה לאחור, ו'להישאר מחובר' מאפס את הספירה", async ({
    browser,
  }) => {
    // Arrange
    await setIdleMinutes(TEST_TIMEOUT_MINUTES);
    const page = await loggedInPage(browser);
    try {
      await openWithFakeClock(page);

      // Act + Assert: לפני האזהרה אין דיאלוג
      await page.clock.fastForward(BEFORE_WARNING_MS);
      await expect(idleDialog(page)).toBeHidden();

      // Act + Assert: בתוך חלון האזהרה
      await page.clock.fastForward(INTO_WARNING_MS - BEFORE_WARNING_MS);
      await expect(idleDialog(page)).toBeVisible(LOAD);
      await expect(idleDialog(page)).toContainText("עדיין כאן?");
      const seconds = Number(
        await page.getByTestId("idle-logout-countdown").textContent(),
      );
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(30);

      // Act: לחיצה בחוץ לא סוגרת
      await page.mouse.click(5, 5);
      await expect(idleDialog(page)).toBeVisible();

      // Act: להישאר מחובר
      await page.getByRole("button", { name: "להישאר מחובר" }).click();

      // Assert: הדיאלוג נסגר והספירה התחילה מחדש
      await expect(idleDialog(page)).toBeHidden();
      await page.clock.fastForward(BEFORE_WARNING_MS);
      await expect(idleDialog(page)).toBeHidden();
      await expect(page).toHaveURL((url) => url.pathname === "/app");
    } finally {
      await page.context().close();
    }
  });

  test("בסוף הספירה המשתמש מנותק ומגיע להתחברות עם הודעה", async ({
    browser,
  }) => {
    // Arrange
    await setIdleMinutes(TEST_TIMEOUT_MINUTES);
    const page = await loggedInPage(browser);
    try {
      await openWithFakeClock(page);

      // Act
      await page.clock.fastForward(INTO_WARNING_MS);
      await expect(idleDialog(page)).toBeVisible(LOAD);
      await page.clock.fastForward(PAST_TIMEOUT_MS);

      // Assert
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/auth/login" &&
          url.searchParams.get("reason") === "idle",
        LOAD,
      );
      await expect(page.getByTestId("login-notice")).toHaveText(
        "נותקת אוטומטית לאחר חוסר פעילות",
      );

      // Assert: הסשן באמת נסגר - /app מפנה להתחברות
      await page.goto("/app");
      await expect(page).toHaveURL(
        (url) => url.pathname === "/auth/login",
        LOAD,
      );
      await expect(page.getByTestId("login-notice")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("בין לשוניות: 'להישאר מחובר' באחת סוגר את האזהרה בשנייה, והתנתקות מנתקת את שתיהן", async ({
    browser,
  }) => {
    // Arrange: שתי לשוניות באותו הקשר (אותו localStorage)
    await setIdleMinutes(TEST_TIMEOUT_MINUTES);
    const first = await loggedInPage(browser);
    const context = first.context();
    try {
      await openWithFakeClock(first);
      const second = await context.newPage();
      await second.goto("/app");
      await expect(second.getByTitle("תפריט משתמש")).toBeVisible(LOAD);

      // Act: חוסר פעילות בשתיהן
      await first.clock.fastForward(INTO_WARNING_MS);
      await expect(idleDialog(first)).toBeVisible(LOAD);
      await expect(idleDialog(second)).toBeVisible(LOAD);

      // Act + Assert: "להישאר מחובר" בראשונה סוגר גם את השנייה
      await first.getByRole("button", { name: "להישאר מחובר" }).click();
      await expect(idleDialog(first)).toBeHidden();
      await expect(idleDialog(second)).toBeHidden(LOAD);

      // Act: "להתנתק" בשנייה
      await first.clock.fastForward(INTO_WARNING_MS);
      await expect(idleDialog(second)).toBeVisible(LOAD);
      await second.getByRole("button", { name: "להתנתק" }).click();

      // Assert: שתיהן בדף ההתחברות, בלי הודעת חוסר פעילות (התנתקות יזומה)
      for (const tab of [first, second]) {
        await expect(tab).toHaveURL(
          (url) =>
            url.pathname === "/auth/login" && !url.searchParams.has("reason"),
          LOAD,
        );
      }
    } finally {
      await context.close();
    }
  });
});
