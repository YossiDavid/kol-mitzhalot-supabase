import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * השהיית כרטיס מתוך בקרת האישור של כרטיס חדש: בתור הכרטיסים החדשים ובדף
 * הכרטיס. ההשהיה אינה החלטת אישור - הכרטיס נשאר ממתין, בתור, עם תג "מושהה",
 * ואפשר לבטל אותה מאותו מקום. בדף הכרטיס נשארים בדף (בלי מעבר לתור).
 */
const T = `${Date.now()}`.slice(-8);
const LAST = `השהיה${T}`;
const FULL_NAME = `מועמד ${LAST}`;
const LOAD = { timeout: 60_000 };
const QUEUE_PATH = "/app/admin/new-cards";

let svc: SupabaseClient;
let cardId = "";

function queueRow(page: Page) {
  return page.getByRole("row", { name: new RegExp(LAST) });
}

async function readCard() {
  const { data } = await svc
    .from("students")
    .select(
      "admin_paused_at, admin_approved_at, admin_rejected_at, in_shidduchim",
    )
    .eq("id", cardId)
    .single();
  return data;
}

async function confirmPauseDialog(page: Page, confirmLabel: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: confirmLabel }).click();
  await expect(dialog).toHaveCount(0, LOAD);
}

test.describe("השהיית כרטיס חדש מבקרת האישור", () => {
  // התור ודף הכרטיס כבדים בשרת הפיתוח
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async () => {
    svc = createServiceClient();
    const ownerId = await ensureCardManagerId(svc);
    // ממתין לאישור: בלי admin_approved_at
    const { data, error } = await svc
      .from("students")
      .insert({
        user_id: ownerId,
        first_name: "מועמד",
        last_name: LAST,
        birth_date: "1999-02-02",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        card_for: "child",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
    cardId = data.id as string;
  });

  test.afterAll(async () => {
    if (cardId) await svc.from("students").delete().eq("id", cardId);
  });

  test("בתור: השהיה משאירה את הכרטיס ממתין עם תג 'מושהה', וביטול מסיר אותו", async ({
    page,
  }) => {
    // Arrange
    await page.goto(QUEUE_PATH, { waitUntil: "domcontentloaded", ...LOAD });
    await expect(queueRow(page)).toBeVisible(LOAD);
    // DataTable מרנדר גם תצוגת מובייל - מצמצמים לשורת הטבלה
    const badge = queueRow(page).getByTestId(`paused-badge-${cardId}`);
    await expect(badge).toHaveCount(0);

    // Act - השהיה
    await queueRow(page)
      .getByRole("button", { name: `השהיית כרטיס: ${FULL_NAME}` })
      .click();
    await confirmPauseDialog(page, "השהה כרטיס");

    // Assert
    await expect(badge).toHaveText("מושהה", LOAD);
    await expect(
      queueRow(page).getByTestId(`approval-status-${cardId}`),
    ).toHaveAttribute("data-status", "pending");
    const paused = await readCard();
    expect(paused?.admin_paused_at).not.toBeNull();
    expect(paused?.admin_approved_at).toBeNull();
    expect(paused?.admin_rejected_at).toBeNull();
    expect(paused?.in_shidduchim).toBe(false);

    // Act - ביטול ההשהיה מאותה שורה
    await queueRow(page)
      .getByRole("button", { name: `ביטול השהיה: ${FULL_NAME}` })
      .click();
    await confirmPauseDialog(page, "ביטול השהיה");

    // Assert
    await expect(badge).toHaveCount(0, LOAD);
    const resumed = await readCard();
    expect(resumed?.admin_paused_at).toBeNull();
    expect(resumed?.admin_approved_at).toBeNull();
  });

  test("בדף הכרטיס: השהיה נשארת בדף ומציגה 'ביטול השהיה'", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${cardId}`, LOAD);
    const controls = page.getByTestId("card-approval-controls");
    await expect(controls).toHaveAttribute("data-status", "pending", LOAD);

    // Act
    await controls
      .getByRole("button", { name: `השהיית כרטיס: ${FULL_NAME}` })
      .click();
    await confirmPauseDialog(page, "השהה כרטיס");

    // Assert
    await expect(
      controls.getByRole("button", { name: `ביטול השהיה: ${FULL_NAME}` }),
    ).toBeVisible(LOAD);
    await expect(page).toHaveURL(new RegExp(`/app/students/${cardId}$`));
    await expect(controls).toHaveAttribute("data-status", "pending");
    expect((await readCard())?.admin_paused_at).not.toBeNull();
  });
});
