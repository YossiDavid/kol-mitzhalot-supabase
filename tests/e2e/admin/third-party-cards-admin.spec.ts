import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  pageAs,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import {
  deleteCards,
  seedFullCard,
} from "../students/third-party-card-fixtures";

/**
 * כרטיס צד שלישי מצד ההנהלה: יצירה (טופס מלא כולל ממליצים והעדפות), התראה
 * למנהלים, נעילת האישורים לכל מי שאינו מנהל, בקרות האישור בכרטיס ובדף
 * הניהול, והתראה לממלא.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const FORBIDDEN_CODE = "42501";
const REFERENCE_NAME = `ממליץ-יצירה-${STAMP}`;
const PARTNER_TEXT = `מחפשים-יצירה-${STAMP}`;
const REASON = `אין-גישה-למחשב-${STAMP}`;

function createPayload(lastName: string) {
  return {
    card_for: "other",
    first_name: "יצירה",
    last_name: lastName,
    birth_date: "1997-05-05",
    gender: "female",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
    in_shidduchim: true,
    cellphone_type: "kosher",
    author_info: {
      name: "ממלא",
      phone: "0521234567",
      relation: "שדכן/ית",
      relationType: "shadchan",
      knowsWell: true,
      fillReason: REASON,
    },
    references: [
      {
        reference_type: "friend",
        name: REFERENCE_NAME,
        phone: "0501112222",
        email: null,
      },
    ],
    partner_preferences: {
      age_min: 20,
      age_max: 30,
      preferred_countries: [],
      work_status: [],
      about_partner: PARTNER_TEXT,
      additional_information: "מידע",
    },
    // שדות שאסור לקבל מלקוח: נדחים בשקט (ה-RPC לא קורא אותם) ובמסד
    third_party_full_display_approved_at: new Date().toISOString(),
    third_party_proposals_approved_at: new Date().toISOString(),
    third_party_full_display_approved_by:
      "00000000-0000-4000-8000-000000000000",
  };
}

test.describe("כרטיס צד שלישי - הנהלה", () => {
  test.describe.configure({ mode: "serial" });

  let svc: SupabaseClient;
  let ownerId: string;
  let adminId: string;
  let cardId: string;
  const lastName = `הנהלה${STAMP}`;
  const extraCards: string[] = [];

  test.beforeAll(async () => {
    svc = createServiceClient();
    ownerId = await ensureCardManagerId(svc);
    const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const adminUser = data.users.find((user) => user.email === ADMIN_EMAIL);
    if (!adminUser) throw new Error("משתמש המנהל לא נמצא - האם הסטאפ רץ?");
    adminId = adminUser.id;
  });

  test.afterAll(async () => {
    await deleteCards(svc, [cardId, ...extraCards].filter(Boolean));
  });

  test("הממלא שומר טופס מלא (ממליצים והעדפות), אישורים מזויפים נדחים, והמנהלים מקבלים התראה", async ({
    browser,
  }) => {
    // Arrange
    const filler = await pageAs(browser, svc, CARD_MANAGER_EMAIL, "/app");

    // Act
    const created = await filler.request.post("/api/v1/students", {
      headers: { Origin: BASE_URL },
      data: { payload: createPayload(lastName) },
    });

    // Assert
    expect(created.status()).toBe(201);
    cardId = (await created.json()).id;
    const { data: card } = await svc
      .from("students")
      .select(
        "card_for, third_party_full_display_approved_at, third_party_full_display_approved_by, third_party_proposals_approved_at, references(name), partner_preferences(about_partner)",
      )
      .eq("id", cardId)
      .single();
    expect(card?.card_for).toBe("other");
    expect(card?.third_party_full_display_approved_at).toBeNull();
    expect(card?.third_party_full_display_approved_by).toBeNull();
    expect(card?.third_party_proposals_approved_at).toBeNull();
    expect(card?.references).toEqual([{ name: REFERENCE_NAME }]);
    expect(card?.partner_preferences).toEqual({ about_partner: PARTNER_TEXT });

    const { data: notifications } = await svc
      .from("notifications")
      .select("type, link, user_id")
      .eq("related_id", cardId)
      .eq("type", "third_party_card_created");
    expect(notifications?.some((row) => row.user_id === adminId)).toBe(true);
    expect(notifications?.[0]?.link).toBe("/app/admin/third-party-cards");

    // עדכון עם אישורים מזויפים: גם הוא לא משנה אותם
    const updated = await filler.request.put(
      `/api/v1/students/${cardId}/profile`,
      {
        headers: { Origin: BASE_URL },
        data: { payload: createPayload(lastName) },
      },
    );
    expect(updated.status()).toBe(200);
    const { data: after } = await svc
      .from("students")
      .select("third_party_full_display_approved_at")
      .eq("id", cardId)
      .single();
    expect(after?.third_party_full_display_approved_at).toBeNull();
    await filler.context().close();
  });

  test("מנהל הכרטיס לא מאשר ולא מבטל בעצמו (כתיבה ישירה)", async () => {
    // Arrange
    const owner = await clientAs(svc, CARD_MANAGER_EMAIL);

    // Act
    const approve = await owner
      .from("students")
      .update({ third_party_proposals_approved_at: new Date().toISOString() })
      .eq("id", cardId);
    await svc
      .from("students")
      .update({ third_party_proposals_approved_at: new Date().toISOString() })
      .eq("id", cardId);
    const revoke = await owner
      .from("students")
      .update({ third_party_proposals_approved_at: null })
      .eq("id", cardId);
    const { data } = await svc
      .from("students")
      .select("third_party_proposals_approved_at")
      .eq("id", cardId)
      .single();
    await svc
      .from("students")
      .update({ third_party_proposals_approved_at: null })
      .eq("id", cardId);

    // Assert
    expect(approve.error?.code).toBe(FORBIDDEN_CODE);
    expect(revoke.error?.code).toBe(FORBIDDEN_CODE);
    expect(data?.third_party_proposals_approved_at).not.toBeNull();
  });

  test("יצירה ישירה עם אישור כבר מאושר נדחית לכל מי שאינו מנהל", async () => {
    // Arrange
    const owner = await clientAs(svc, CARD_MANAGER_EMAIL);

    // Act
    const inserted = await owner.from("students").insert({
      user_id: ownerId,
      card_for: "other",
      first_name: "ישיר",
      last_name: `ישיר${STAMP}`,
      birth_date: "1997-05-05",
      gender: "female",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      third_party_full_display_approved_at: new Date().toISOString(),
    });

    // Assert
    expect(inserted.error?.code).toBe(FORBIDDEN_CODE);
  });

  test("כרטיס שחוזר להיות צד שלישי מתחיל לא מאושר", async () => {
    // Arrange
    const id = await seedFullCard(svc, { ownerId, lastName: `חוזר${STAMP}` });
    extraCards.push(id);
    const now = new Date().toISOString();
    await svc
      .from("students")
      .update({
        third_party_full_display_approved_at: now,
        third_party_proposals_approved_at: now,
      })
      .eq("id", id);
    const owner = await clientAs(svc, CARD_MANAGER_EMAIL);

    // Act - הממלא הופך אותו לעצמי, ואז שוב לצד שלישי
    await owner.from("students").update({ card_for: "self" }).eq("id", id);
    const stillStored = await svc
      .from("students")
      .select("third_party_full_display_approved_at")
      .eq("id", id)
      .single();
    await owner.from("students").update({ card_for: "other" }).eq("id", id);
    const { data } = await svc
      .from("students")
      .select(
        "third_party_full_display_approved_at, third_party_proposals_approved_at",
      )
      .eq("id", id)
      .single();

    // Assert - עצמי: לא נמחק אוטומטית; חזרה ל-other: מתחיל מאפס
    expect(
      stillStored.data?.third_party_full_display_approved_at,
    ).not.toBeNull();
    expect(data).toEqual({
      third_party_full_display_approved_at: null,
      third_party_proposals_approved_at: null,
    });
  });

  test("מנהל בכרטיס: רואה הסבר ובקרות, מאשר הצגה, והשדכן רואה את הכרטיס המלא", async ({
    page,
    browser,
  }) => {
    // Arrange + Act
    await page.goto(`/app/students/${cardId}`);

    // Assert - מנהל רואה הכול כבר לפני אישור
    await expect(
      page.getByTestId("third-party-approval-controls"),
    ).toBeVisible();
    await expect(page.getByTestId("author-fill-reason")).toContainText(REASON);
    await expect(page.getByText(REFERENCE_NAME)).toBeVisible();
    await expect(page.getByTestId("third-party-hidden-note")).toHaveCount(0);

    // Act - אישור הצגה מלאה
    const approvalResponse = page.waitForResponse((response) =>
      response.url().includes("/third-party-approval"),
    );
    await page
      .getByRole("button", { name: "אישור: הצגת נתונים מלאים" })
      .click();
    const response = await approvalResponse;
    expect(response.status(), await response.text()).toBe(200);
    await expect(page.getByTestId("approval-full_display")).toHaveAttribute(
      "data-approved",
      "true",
    );

    // Assert - DB, התראה לממלא, ותצוגת שדכן
    const { data: row } = await svc
      .from("students")
      .select(
        "third_party_full_display_approved_at, third_party_full_display_approved_by, third_party_proposals_approved_at",
      )
      .eq("id", cardId)
      .single();
    expect(row?.third_party_full_display_approved_at).not.toBeNull();
    expect(row?.third_party_full_display_approved_by).toBe(adminId);
    expect(row?.third_party_proposals_approved_at).toBeNull();
    const { data: notice } = await svc
      .from("notifications")
      .select("user_id, link")
      .eq("related_id", cardId)
      .eq("type", "third_party_card_approved");
    expect(notice?.map((n) => n.user_id)).toContain(ownerId);

    const matchmaker = await pageAs(
      browser,
      svc,
      TEST_USER_EMAIL,
      `/app/students/${cardId}`,
    );
    // pageAs חוזר ברגע שהכתובת עברה, לפני שתוכן הכרטיס (Suspense) הגיע: ממתינים
    // לסימן שהכרטיס המלא עלה, ורק אז קוראים את ה-HTML
    await expect(matchmaker.getByText(REFERENCE_NAME)).toBeVisible();
    const html = await matchmaker.content();
    expect(html).toContain(REFERENCE_NAME);
    expect(html).not.toContain(REASON);
    await matchmaker.context().close();
  });

  test("דף הניהול: הכרטיס ברשימת הממתינים עם ההסבר, והמתגים עובדים", async ({
    page,
  }) => {
    // Arrange + Act
    await page.goto("/app/admin/third-party-cards");
    const row = page.getByRole("row", { name: new RegExp(lastName) });

    // Assert - הצעות עוד לא אושרו, ולכן הכרטיס ממתין
    await expect(row).toBeVisible();
    await expect(row.getByTestId(`reason-${cardId}`)).toHaveText(REASON);
    await expect(row.getByTestId(`filler-${cardId}`)).toContainText("ממלא");
    await expect(row.getByTestId(`filler-${cardId}`)).toContainText(
      "מכיר/ה היטב: כן",
    );

    // Act - אישור הצעות מהרשימה המלאה (בברירת המחדל הכרטיס יוצא ברגע שאושר)
    await page.goto("/app/admin/third-party-cards?filter=all");
    const allRow = page.getByRole("row", { name: new RegExp(lastName) });
    await allRow
      .getByRole("button", { name: "אישור: אפשרות לשלוח הצעות" })
      .click();
    await expect(allRow.getByTestId("approval-proposals")).toHaveAttribute(
      "data-approved",
      "true",
    );
    const { data } = await svc
      .from("students")
      .select("third_party_proposals_approved_at")
      .eq("id", cardId)
      .single();
    expect(data?.third_party_proposals_approved_at).not.toBeNull();

    // הכרטיס אושר לגמרי: יוצא מברירת המחדל ונשאר ב"כל הכרטיסים"
    await page.goto("/app/admin/third-party-cards");
    await expect(
      page.getByRole("row", { name: new RegExp(lastName) }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "כל הכרטיסים" }).click();
    await expect(allRow).toBeVisible();

    // Act - ביטול אישור מהרשימה
    await page
      .getByRole("row", { name: new RegExp(lastName) })
      .getByRole("button", { name: "ביטול אישור: אפשרות לשלוח הצעות" })
      .click();
    await expect(
      page
        .getByRole("row", { name: new RegExp(lastName) })
        .getByTestId("approval-proposals"),
    ).toHaveAttribute("data-approved", "false");
  });

  test("מי שאינו מנהל לא יכול לקרוא ל-route האישור", async ({ browser }) => {
    // Arrange
    const filler = await pageAs(browser, svc, CARD_MANAGER_EMAIL, "/app");

    // Act
    const response = await filler.request.patch(
      `/api/v1/students/${cardId}/third-party-approval`,
      {
        headers: { Origin: BASE_URL },
        data: { kind: "proposals", approved: true },
      },
    );

    // Assert
    expect(response.status()).toBe(403);
    await filler.context().close();
  });

  test("תג בטבלת הילדים של פרטי המשתמש", async ({ page }) => {
    // Act
    await page.goto(`/app/admin/users/${ownerId}`);

    // Assert
    await expect(
      page.getByTestId("third-party-card-tag").first(),
    ).toBeVisible();
  });
});
