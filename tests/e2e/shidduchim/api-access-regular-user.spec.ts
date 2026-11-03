import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { CARD_MANAGER_EMAIL, pageAs } from "../chats/context-fixtures";
import { createServiceClient, getTestUserId } from "./fixtures";

/**
 * נתיבים שמשתמשים ב-service role לא חושפים מידע למשתמש רגיל (מנהל כרטיס):
 * היסטוריית הצעות של צמד, ופרטי משתמש אחר (אימייל).
 */
test.describe("נתיבי API חסומים למשתמש רגיל", () => {
  test("pair-status מחזיר 403, ו-/users/[id] אינו קיים", async ({
    browser,
  }) => {
    // Arrange
    const admin = createServiceClient();
    const shadchanId = await getTestUserId(admin);
    const page = await pageAs(browser, admin, CARD_MANAGER_EMAIL, "/app");

    // Act
    const pair = await page.request.get(
      `/api/v1/shidduchim/pair-status?groomId=${randomUUID()}&brideId=${randomUUID()}`,
    );
    const userInfo = await page.request.get(`/api/v1/users/${shadchanId}`);

    // Assert
    expect(pair.status()).toBe(403);
    expect(userInfo.status()).toBe(404);
    await page.context().close();
  });
});
