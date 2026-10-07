import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { CARD_MANAGER_EMAIL, pageAs } from "../chats/context-fixtures";

/**
 * סרגל הצד מחולק לקבוצות: שדכן/מנהל רואה "כללי", "כלי שדכן" ו"האזור האישי
 * שלי"; הורה (בלי תפקיד) רואה קבוצה אחת, "ניווט". משתמש הבדיקה הוא שדכן.
 */
const sidebarGroup = (page: Page, label: string): Locator =>
  page.locator('[data-sidebar="group"]').filter({
    has: page.locator('[data-sidebar="group-label"]', { hasText: label }),
  });

const groupLabels = (page: Page) =>
  page.locator('[data-sidebar="group-label"]');

test.describe("סרגל צד — קבוצות", () => {
  test("שדכן: שלוש קבוצות והפריטים בקבוצה הנכונה", async ({ page }) => {
    // Act
    await page.goto("/app");

    // Assert
    await expect(groupLabels(page)).toHaveText([
      "כללי",
      "כלי שדכן",
      "האזור האישי שלי",
      "מידע ותוכן",
    ]);
    const hrefsOf = async (label: string) =>
      sidebarGroup(page, label)
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(await hrefsOf("כללי")).toEqual([
      "/app",
      "/app/chats",
      "/app/settings",
    ]);
    expect(await hrefsOf("כלי שדכן")).toEqual([
      "/app/students",
      "/app/canvas",
      "/app/shadchan/proposals",
      "/app/shadchan/drafts",
      "/app/forums",
    ]);
    expect(await hrefsOf("האזור האישי שלי")).toEqual([
      "/app/students/create",
      "/app/proposals",
      "/app/shadchanim",
    ]);
  });

  test("הורה: קבוצת ניווט אחת, בלי כלי שדכן", async ({ browser }) => {
    // Arrange
    const admin = createServiceClient();
    await ensureCardManagerId(admin);
    const page = await pageAs(browser, admin, CARD_MANAGER_EMAIL, "/app");

    try {
      // Assert
      await expect(groupLabels(page)).toHaveText(["ניווט", "מידע ותוכן"]);
      await expect(page.getByText("כלי שדכן", { exact: true })).toHaveCount(0);
      const hrefs = await sidebarGroup(page, "ניווט")
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(hrefs).toEqual([
        "/app",
        "/app/students/create",
        "/app/chats",
        "/app/proposals",
        "/app/shadchanim",
        "/app/settings",
      ]);
    } finally {
      await page.context().close();
    }
  });
});
