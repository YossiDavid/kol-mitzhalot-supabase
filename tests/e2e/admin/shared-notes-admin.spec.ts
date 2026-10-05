import { expect, test } from "@playwright/test";

import {
  createServiceClient,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/** מנהל רואה הערות שדכן של אחרים, ורשאי לערוך ולמחוק אותן */
const admin = createServiceClient();
const NOTE = `הערת שדכן למנהל ${Date.now()}`;

let fixtures: ShidduchFixtures;

test.beforeAll(async () => {
  fixtures = await setupShidduchFixtures(admin);
  const { error } = await admin.from("student_notes").insert({
    student_id: fixtures.groomFirst,
    author_id: fixtures.otherShadchanId,
    author_role: "shadchan",
    body: NOTE,
  });
  if (error) throw new Error(`הכנת הערה נכשלה: ${error.message}`);
});

test.afterAll(async () => {
  await teardownShidduchFixtures(admin, fixtures);
});

test("מנהל רואה הערת שדכן אחר עם כפתורי עריכה ומחיקה", async ({ page }) => {
  await page.goto(`/app/students/${fixtures.groomFirst}`);

  const item = page.getByRole("listitem").filter({ hasText: NOTE });
  await expect(item).toBeVisible({ timeout: 15_000 });
  await expect(item.getByText("Fixture Shadchan")).toBeVisible();
  await expect(item.getByRole("button", { name: "עריכת ההערה" })).toBeVisible();
  await expect(item.getByRole("button", { name: "מחיקת ההערה" })).toBeVisible();
});
