import { expect, test } from "@playwright/test";

/**
 * CSP במצב דיווח (next.config.ts) בדפי המערכת, למנהל מחובר: Supabase (REST,
 * Storage, Realtime) ו-Google Analytics מותרים, ואין הפרות בקונסול.
 */
const PAGES = [
  "/app",
  "/app/students",
  "/app/chats",
  "/app/shidduchim",
  "/app/admin",
];

test.describe("CSP במצב דיווח - דפי המערכת", () => {
  for (const path of PAGES) {
    test(`${path}: בלי הפרות`, async ({ page }) => {
      // Arrange
      const violations: string[] = [];
      page.on("console", (message) => {
        if (message.text().includes("Content Security Policy")) {
          violations.push(message.text());
        }
      });

      // Act
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Assert
      expect(violations).toEqual([]);
    });
  }
});
