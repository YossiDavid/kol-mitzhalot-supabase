/**
 * Callers: Playwright `chromium` project (המגיש בהקשר נפרד).
 * טופס ההצטרפות כשדכן: שדכן/שדכנית ותאריך לידה חובה (גיל 18-100), ותמונה
 * חובה לשדכן (male) ורשות לשדכנית. התמונה עולה ל-shadchan-avatars והנתיב נשמר.
 */
import { expect, test, type Page } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";
import {
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";
import { fillShadchanIdentity } from "../helpers/shadchan-form";

const LOAD = { timeout: 30_000 };

async function openJoinForm(page: Page) {
  await page.goto("/app/settings/shadchan");
  await expect(
    page.getByRole("heading", { name: "הצטרפות כשדכן", level: 1 }),
  ).toBeVisible(LOAD);
}

async function fillRest(page: Page) {
  await page.getByLabel("ביוגרפיה").fill("שדכן בדיקה עם ניסיון");
  await page.getByLabel("שנות ניסיון").fill("3");
  await page.getByLabel("כמה שידוכים סגרתי").fill("2");
  await page.getByLabel("טלפון ליצירת קשר").fill("0501234567");
  await page.getByLabel("רב בית הכנסת שלך").fill("הרב בדיקה");
  await page.locator("#community").click();
  await page.getByRole("option").first().click();
}

const storedRow = async (userId: string) =>
  (
    await serviceClient()
      .from("shadchanim_info")
      .select("gender, birth_date, avatar_path, application_status")
      .eq("user_id", userId)
      .maybeSingle()
  ).data;

test.describe("הצטרפות כשדכן - מגדר, גיל ותמונה", () => {
  const created: SessionUser[] = [];

  test.afterAll(async () => {
    const admin = serviceClient();
    for (const user of created) {
      const { data } = await admin.storage
        .from("shadchan-avatars")
        .list(user.id);
      const paths = (data ?? []).map((file) => `${user.id}/${file.name}`);
      if (paths.length)
        await admin.storage.from("shadchan-avatars").remove(paths);
      await admin.from("shadchanim_info").delete().eq("user_id", user.id);
    }
    await deleteSessionUsers(created);
  });

  test("בלי מגדר ותאריך לידה - הודעות חובה; גיל 10 נדחה", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSessionUser({ prefix: "identity-empty" });
    created.push(user);
    const page = await openPageAs(browser, user);

    try {
      await openJoinForm(page);
      await fillRest(page);

      // Act
      await page.getByRole("button", { name: "שלח בקשה" }).click();

      // Assert
      await expect(page.getByText("נא לבחור שדכן / שדכנית")).toBeVisible();
      await expect(page.getByText("נא לבחור תאריך לידה")).toBeVisible();

      // Act - גיל מחוץ לטווח
      await fillShadchanIdentity(page, {
        birthDate: `${new Date().getFullYear() - 10}-01-01`,
      });
      await page.getByRole("button", { name: "שלח בקשה" }).click();

      // Assert
      await expect(
        page.getByText("הגיל חייב להיות בין 18 ל-100"),
      ).toBeVisible();
      expect(await storedRow(user.id)).toBeNull();
    } finally {
      await page.context().close();
    }
  });

  test("שדכן בלי תמונה נחסם; עם תמונה - הבקשה נשמרת עם הנתיב", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSessionUser({ prefix: "identity-male" });
    created.push(user);
    const page = await openPageAs(browser, user);

    try {
      await openJoinForm(page);
      await fillRest(page);
      await fillShadchanIdentity(page, { gender: "male", withAvatar: false });

      // Act
      await page.getByRole("button", { name: "שלח בקשה" }).click();

      // Assert
      await expect(
        page.getByText("נא להעלות תמונה (חובה לשדכנים)"),
      ).toBeVisible();
      expect(await storedRow(user.id)).toBeNull();

      // Act - העלאה ושליחה
      await fillShadchanIdentity(page, { gender: "male" });
      // התצוגה המקדימה של הכרטיס מציגה את התמונה שהועלתה
      await expect(
        page.getByTestId("shadchan-card-preview").locator("img"),
      ).toBeAttached();
      await page.getByRole("button", { name: "שלח בקשה" }).click();
      await expect(page).toHaveURL(/\/app\/settings$/, LOAD);

      // Assert
      const row = await storedRow(user.id);
      expect(row?.application_status).toBe("pending");
      expect(row?.gender).toBe("male");
      expect(row?.avatar_path).toMatch(new RegExp(`^${user.id}/.+\\.png$`));
    } finally {
      await page.context().close();
    }
  });

  test("שדכנית בלי תמונה - הבקשה נשמרת", async ({ browser }) => {
    // Arrange
    const user = await createSessionUser({ prefix: "identity-female" });
    created.push(user);
    const page = await openPageAs(browser, user);

    try {
      await openJoinForm(page);
      await fillRest(page);
      await fillShadchanIdentity(page, { gender: "female" });

      // Act
      await page.getByRole("button", { name: "שלח בקשה" }).click();
      await expect(page).toHaveURL(/\/app\/settings$/, LOAD);

      // Assert
      const row = await storedRow(user.id);
      expect(row?.gender).toBe("female");
      expect(row?.avatar_path).toBeNull();
    } finally {
      await page.context().close();
    }
  });
});
