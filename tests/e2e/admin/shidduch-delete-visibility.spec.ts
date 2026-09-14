import { expect, test } from "@playwright/test";

import { SEED } from "../shidduchim/fixtures";

/**
 * מנהל רואה כרטיס של הצעה שיצר שדכן אחר, אבל אינו רשאי למחוק אותה — כך
 * מדיניות ה-RLS, ולכן גם הכפתור אינו אמור להופיע לו. בלי הבדיקה הזו קל
 * להחזיר בטעות את הכפתור לכל מי שרואה את הכרטיס, ולקבל 404 מהשרת רק אחרי
 * שהמשתמש כבר לחץ ואישר מחיקה.
 */
test.describe("כרטיס שידוך — כפתור המחיקה מוצג לבעלים בלבד", () => {
  test("מנהל רואה את הכרטיס של שדכן אחר, בלי כפתור מחיקה", async ({ page }) => {
    await page.goto(`/app/shidduchim/${SEED.existingDraftId}`);

    // המנהל אכן מגיע לתצוגת הניהול של הכרטיס, ולא ל-404
    await expect(
      page.getByRole("heading", { name: "כרטיס שידוך" }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("button", { name: "מחיקת ההצעה" })).toHaveCount(
      0,
    );
  });
});
