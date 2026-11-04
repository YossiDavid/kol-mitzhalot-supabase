import { expect, test } from "@playwright/test";

import { createCard } from "../chats/context-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * קישור השיתוף הציבורי לא פותח כרטיס בלעדי, מושהה, מחוץ לשידוכים, מאורס
 * או בהקפאת שידוכים. כרטיס רגיל נפתח.
 */
const UNAVAILABLE = "הכרטיס אינו זמין";

test.describe("קישור השיתוף הציבורי לפי מצב הכרטיס", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const svc = createServiceClient();
  const cards: string[] = [];
  const T = `${Date.now()}`.slice(-8);

  async function card(update: Record<string, unknown> = {}) {
    const id = await createCard(svc, {
      userId: await ensureCardManagerId(svc),
      gender: "male",
      firstName: "שיתוף",
      lastName: `מצב${T}`,
    });
    cards.push(id);
    if (Object.keys(update).length > 0) {
      const { error } = await svc.from("students").update(update).eq("id", id);
      if (error) throw new Error(error.message);
    }
    return id;
  }

  test.afterAll(async () => {
    await deleteCards(svc, cards);
  });

  test("כרטיס רגיל נפתח", async ({ page }) => {
    await page.goto(`/app/students/${await card()}`);
    await expect(page.getByText(`מצב${T}`).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(UNAVAILABLE)).toHaveCount(0);
  });

  const now = new Date().toISOString();
  for (const [label, update] of [
    ["בלעדי למנהל", { admin_exclusive_at: now }],
    ["מושהה", { admin_paused_at: now }],
    ["מחוץ לשידוכים", { in_shidduchim: false }],
    ["מאורס", { personal_status: "engaged" }],
    ["בהקפאת שידוכים", { matchmaking_hold_at: now }],
  ] as const) {
    test(`${label}: לא נפתח`, async ({ page }) => {
      await page.goto(`/app/students/${await card(update)}`);
      await expect(page.getByText(UNAVAILABLE)).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(`מצב${T}`)).toHaveCount(0);
    });
  }
});
