import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * מנהל רואה כרטיס של הצעה שיצר שדכן אחר, אבל אינו רשאי למחוק אותה — כך
 * מדיניות ה-RLS, ולכן גם הכפתור אינו אמור להופיע לו. בלי הבדיקה הזו קל
 * להחזיר בטעות את הכפתור לכל מי שרואה את הכרטיס, ולקבל 404 מהשרת רק אחרי
 * שהמשתמש כבר לחץ ואישר מחיקה.
 *
 * ההצעה נוצרת כאן בבעלות שדכן ייעודי שאינו המנהל, ולא נשענת על
 * supabase/seed.sql שרץ רק על המסד המקומי.
 */
test.describe("כרטיס שידוך — כפתור המחיקה מוצג לבעלים בלבד", () => {
  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let othersShidduchId: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    fx = await setupShidduchFixtures(admin);
    othersShidduchId = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: fx.otherShadchanId,
      noteForGroom: "הצעה של שדכן אחר",
    });
  });

  test.afterAll(async () => {
    // מחיקת המיועדים גוררת גם את ההצעה ב-cascade
    await teardownShidduchFixtures(admin, fx);
  });

  test("מנהל רואה את הכרטיס של שדכן אחר, בלי כפתור מחיקה", async ({ page }) => {
    await page.goto(`/app/shidduchim/${othersShidduchId}`);

    // המנהל אכן מגיע לתצוגת הניהול של הכרטיס, ולא ל-404
    await expect(page.getByRole("heading", { name: "כרטיס שידוך" })).toBeVisible(
      { timeout: 15_000 },
    );

    await expect(page.getByRole("button", { name: "מחיקת ההצעה" })).toHaveCount(
      0,
    );
  });
});
