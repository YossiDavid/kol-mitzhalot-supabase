/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * מטרות ההרשמה "איש צוות" ו"אחר" (עם טקסט חופשי) בטבלת המשתמשים ובדף המשתמש
 * של המנהל: "אחר: <טקסט>" רק למטרה "אחר"; הטקסט מוצג כטקסט (לא כ-HTML).
 */
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";

const RUN = Date.now();
const OTHER_TEXT = `רוצה לעזור בהתנדבות ${RUN} <b>x</b>`;
const LOAD = { timeout: 15_000 };

type SeededUser = { id: string; email: string };

async function createUser(
  tag: string,
  metadata: Record<string, string>,
): Promise<SeededUser> {
  const email = `purpose-${tag}-${randomUUID()}@kol-mitzhalot.test`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    phone: `+9725${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    email_confirm: true,
    user_metadata: { firstName: "מטרה", lastName: tag, ...metadata },
  });
  if (error || !data.user)
    throw new Error(`יצירת משתמש נכשלה: ${error?.message}`);
  return { id: data.user.id, email };
}

test.describe("ניהול - מטרת הרשמה: איש צוות ו'אחר'", () => {
  let other: SeededUser;
  let staff: SeededUser;
  let plain: SeededUser;

  test.beforeAll(async () => {
    other = await createUser("other", {
      signup_purpose: "other",
      signup_purpose_other: OTHER_TEXT,
    });
    staff = await createUser("staff", { signup_purpose: "staff" });
    // טקסט חופשי בלי מטרה "אחר" - לא מוצג
    plain = await createUser("self", {
      signup_purpose: "self",
      signup_purpose_other: "לא אמור להופיע",
    });
  });

  test.afterAll(async () => {
    const admin = serviceClient();
    for (const user of [other, staff, plain]) {
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("טבלת המשתמשים: 'אחר: <טקסט>' ו'איש צוות'", async ({ page }) => {
    await page.goto(`/app/admin/users?q=${encodeURIComponent(other.email)}`);
    await expect(
      page.getByRole("table").getByText(`אחר: ${OTHER_TEXT}`),
    ).toBeVisible(LOAD);

    await page.goto(`/app/admin/users?q=${encodeURIComponent(staff.email)}`);
    await expect(
      page.getByRole("table").getByText("אני רוצה להצטרף כאיש צוות"),
    ).toBeVisible(LOAD);

    await page.goto(`/app/admin/users?q=${encodeURIComponent(plain.email)}`);
    await expect(
      page.getByRole("table").getByText("אני מחפש/ת שידוך לעצמי"),
    ).toBeVisible(LOAD);
    await expect(page.getByText("לא אמור להופיע")).toHaveCount(0);
  });

  test("דף המשתמש: התווית המלאה, והטקסט לא מפורש כ-HTML", async ({ page }) => {
    await page.goto(`/app/admin/users/${other.id}`);
    await expect(
      page.getByText(`אחר: ${OTHER_TEXT}`, { exact: false }),
    ).toBeVisible(LOAD);
    await expect(page.locator("main b", { hasText: /^x$/ })).toHaveCount(0);

    await page.goto(`/app/admin/users/${staff.id}`);
    await expect(
      page.getByText("אני רוצה להצטרף כאיש צוות").first(),
    ).toBeVisible(LOAD);
  });
});
