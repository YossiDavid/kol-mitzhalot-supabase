import { expect, test } from "@playwright/test";

import {
  createServiceClient,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * מודעה שנוצרה אוטומטית משידוך שהושלם מסומנת בעמוד מודעות מאורסים,
 * עם קישורים לשני הכרטיסים ולהצעה; מודעה ידנית אינה מסומנת.
 */
const admin = createServiceClient();
const MANUAL_GROOM = `חתן ידני ${Date.now()}`;

let fixtures: ShidduchFixtures;
let shidduchId: string;
let systemGroomName: string;

test.beforeAll(async () => {
  fixtures = await setupShidduchFixtures(admin);
  shidduchId = await insertShidduch(admin, {
    groomId: fixtures.groomFirst,
    brideId: fixtures.brideFirst,
    shadchanId: fixtures.otherShadchanId,
  });
  systemGroomName = `חתן מערכת ${Date.now()}`;

  const { error } = await admin.from("engagements").insert([
    {
      groom_name: systemGroomName,
      bride_name: "כלה מערכת",
      is_published: false,
      source: "system",
      shidduch_id: shidduchId,
      groom_student_id: fixtures.groomFirst,
      bride_student_id: fixtures.brideFirst,
    },
    { groom_name: MANUAL_GROOM, bride_name: "כלה ידנית", source: "admin" },
  ]);
  if (error) throw new Error(`הכנת מודעות נכשלה: ${error.message}`);
});

test.afterAll(async () => {
  await admin
    .from("engagements")
    .delete()
    .in("groom_name", [systemGroomName, MANUAL_GROOM]);
  await teardownShidduchFixtures(admin, fixtures);
});

test("מודעה אוטומטית מציגה תג וקישורים, ומודעה ידנית לא", async ({ page }) => {
  await page.goto("/app/admin/content/engagements");

  const systemRow = page.getByRole("row").filter({ hasText: systemGroomName });
  await expect(systemRow).toBeVisible({ timeout: 15_000 });
  await expect(systemRow.getByText("נוצר אוטומטית מהמערכת")).toBeVisible();
  await expect(
    systemRow.getByRole("link", { name: "כרטיס החתן" }),
  ).toHaveAttribute("href", `/app/students/${fixtures.groomFirst}`);
  await expect(
    systemRow.getByRole("link", { name: "כרטיס הכלה" }),
  ).toHaveAttribute("href", `/app/students/${fixtures.brideFirst}`);
  await expect(systemRow.getByRole("link", { name: "ההצעה" })).toHaveAttribute(
    "href",
    `/app/shidduchim/${shidduchId}`,
  );

  const manualRow = page.getByRole("row").filter({ hasText: MANUAL_GROOM });
  await expect(manualRow).toBeVisible();
  await expect(manualRow.getByText("נוצר אוטומטית מהמערכת")).toHaveCount(0);
});
