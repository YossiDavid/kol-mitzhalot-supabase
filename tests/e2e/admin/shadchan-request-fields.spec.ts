import { expect, test } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * דף בקשות ההצטרפות כשדכן מציג למנהל את טלפון, קהילה ורב בית הכנסת - וגם
 * בקשה ישנה שהוגשה בלי השדות (מסומנת "לא צוין", בלי לשבור את הדף).
 */
const RUN_ID = Date.now();
const FULL_EMAIL = `req-full-${RUN_ID}@kol-mitzhalot.test`;
const LEGACY_EMAIL = `req-legacy-${RUN_ID}@kol-mitzhalot.test`;
const RABBI = `הרב-בדיקה-${RUN_ID}`;
const COMMUNITY = `קהילת-בדיקה-${RUN_ID}`;
const PHONE = "0509998877";
const RABBI_PHONE = "0521112233";
const CITY = `עיר-בדיקה-${RUN_ID}`;

const admin = createServiceClient();
const userIds: string[] = [];

async function createApplicant(email: string, index: number) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone: `+9725${String(RUN_ID).slice(-7)}${index}`,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { firstName: "מבקש", lastName: `בקשה${index}` },
  });
  if (error || !data.user) throw new Error(`יצירת מבקש: ${error?.message}`);
  userIds.push(data.user.id);
  return data.user.id;
}

test.beforeAll(async () => {
  const fullId = await createApplicant(FULL_EMAIL, 1);
  const legacyId = await createApplicant(LEGACY_EMAIL, 2);
  const { error } = await admin.from("shadchanim_info").insert([
    {
      user_id: fullId,
      application_status: "pending",
      submitted_at: new Date().toISOString(),
      bio: "ביוגרפיה",
      contact_phone: PHONE,
      community: COMMUNITY,
      synagogue_rabbi: RABBI,
      rabbi_phone: RABBI_PHONE,
      location: CITY,
      match_types: ["young", "divorced"],
    },
    {
      user_id: legacyId,
      application_status: "pending",
      submitted_at: new Date().toISOString(),
      bio: "בקשה ישנה",
    },
  ]);
  if (error) throw new Error(`יצירת בקשות: ${error.message}`);
});

test.afterAll(async () => {
  await admin.from("shadchanim_info").delete().in("user_id", userIds);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

test.describe("בקשות הצטרפות כשדכן - שדות החובה אצל המנהל", () => {
  test("בקשה מלאה מציגה טלפון, קהילה ורב", async ({ page }) => {
    // Act
    await page.goto("/app/admin/shadchanim/requests");
    const card = page
      .locator("[data-slot='card']")
      .filter({ hasText: FULL_EMAIL });

    // Assert
    await expect(card.getByTestId("request-phone")).toHaveText(PHONE);
    await expect(card.getByTestId("request-community")).toHaveText(COMMUNITY);
    await expect(card.getByTestId("request-rabbi")).toHaveText(RABBI);
    await expect(card.getByTestId("request-rabbi-phone")).toHaveText(
      RABBI_PHONE,
    );
    await expect(card.getByTestId("request-city")).toHaveText(CITY);
    await expect(card.getByTestId("request-match-types")).toHaveText(
      "צעירים, גרושים / גרושות",
    );
  });

  test("בקשה ישנה בלי השדות נטענת ומסומנת 'לא צוין'", async ({ page }) => {
    // Act
    await page.goto("/app/admin/shadchanim/requests");
    const card = page
      .locator("[data-slot='card']")
      .filter({ hasText: LEGACY_EMAIL });

    // Assert
    for (const field of [
      "phone",
      "community",
      "rabbi",
      "rabbi-phone",
      "city",
      "match-types",
    ]) {
      await expect(card.getByTestId(`request-${field}`)).toContainText(
        "לא צוין",
      );
    }
  });
});
