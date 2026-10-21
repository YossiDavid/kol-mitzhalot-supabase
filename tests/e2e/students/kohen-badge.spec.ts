import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { approvedCard } from "../helpers/approved-card";
import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * מועמד שסימן "כהן" מובלט: תג "כהן" בשורת המאגר ובהדר הכרטיס, ובפרטים
 * האישיים תג במקום "כן". מועמד שאינו כהן - בלי תג.
 */
const T = `${Date.now()}`.slice(-8);
const KOHEN_LAST = `כהןתג${T}`;
const PLAIN_LAST = `ישראלתג${T}`;
const LOAD_TIMEOUT = 30_000;

let svc: SupabaseClient;
let kohenId = "";
let plainId = "";

async function seed(lastName: string, isKohen: boolean) {
  const ownerId = await ensureCardManagerId(svc);
  const { data, error } = await svc
    .from("students")
    .insert(
      approvedCard({
        user_id: ownerId,
        first_name: "מועמד",
        last_name: lastName,
        birth_date: "1998-06-06",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        is_kohen: isKohen,
      }),
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
  return data.id as string;
}

const rowFor = (page: Page, lastName: string) =>
  page.getByRole("row", { name: new RegExp(lastName) });

test.describe("תג כהן בולט", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async () => {
    svc = createServiceClient();
    kohenId = await seed(KOHEN_LAST, true);
    plainId = await seed(PLAIN_LAST, false);
  });

  test.afterAll(async () => {
    await svc.from("students").delete().in("id", [kohenId, plainId]);
  });

  test("במאגר: תג 'כהן' רק בשורה של הכהן", async ({ page }) => {
    // Act
    await page.goto("/app/students");
    await page.locator("#search").fill(T);
    await expect(rowFor(page, KOHEN_LAST)).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });

    // Assert
    await expect(
      rowFor(page, KOHEN_LAST).getByTestId("kohen-badge"),
    ).toHaveText("כהן");
    await expect(rowFor(page, PLAIN_LAST)).toBeVisible();
    await expect(
      rowFor(page, PLAIN_LAST).getByTestId("kohen-badge"),
    ).toHaveCount(0);
  });

  test("בכרטיס: תג בהדר ובפרטים האישיים", async ({ page }) => {
    // Act
    await page.goto(`/app/students/${kohenId}`);

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(KOHEN_LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByTestId("kohen-badge")).toHaveCount(2);

    await page.goto(`/app/students/${plainId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(PLAIN_LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByTestId("kohen-badge")).toHaveCount(0);
  });
});
