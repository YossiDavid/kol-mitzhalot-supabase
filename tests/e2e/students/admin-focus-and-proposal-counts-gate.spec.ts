import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  insertProposal,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { buildStudentsPageQuery } from "../../../features/students/lib/students-list-query";
import { STUDENT_CARDS_VIEW } from "../../../features/students/lib/third-party-card";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * שתי הרשאות חדשות, בשכבת המסד ובנתיב (הבדיקה רצה בסשן של שדכן):
 *   1. "במיקוד" (student_admin_focus): רק מנהל מסמן - שדכן נדחה בנתיב ואינו
 *      כותב לטבלה ישירות. הסימון גלוי לשדכן ב-student_cards, ולא לבעל הכרטיס.
 *   2. get_card_proposal_counts: אותה הרשאה כמו get_card_proposal_count, לכל
 *      מזהה בנפרד - כרטיס שאינו מאושר (או גולש) מקבל null / שגיאה.
 */
const T = `${Date.now()}`.slice(-8);
const LAST = `מיקוד${T}`;
const NOTE = `הערת-מיקוד-${T}`;

type JsonRecord = Record<string, unknown>;

let svc: SupabaseClient;
let matchmaker: SupabaseClient;
let owner: SupabaseClient;
let ownerId = "";
let matchmakerId = "";
let groomId = "";
let brideId = "";
let unapprovedId = "";

test.beforeAll(async () => {
  svc = createServiceClient();
  [ownerId, matchmakerId] = await Promise.all([
    ensureCardManagerId(svc),
    getTestUserId(svc),
  ]);
  [matchmaker, owner] = await Promise.all([
    clientAs(svc, TEST_USER_EMAIL),
    clientAs(svc, CARD_MANAGER_EMAIL),
  ]);
  const card = (gender: "male" | "female", firstName: string) =>
    createCard(svc, { userId: ownerId, gender, firstName, lastName: LAST });
  groomId = await card("male", "חתן");
  brideId = await card("female", "כלה");
  const { data, error } = await svc
    .from("students")
    .insert({
      user_id: ownerId,
      first_name: "ממתין",
      last_name: LAST,
      birth_date: "1998-01-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`כרטיס ממתין: ${error?.message}`);
  unapprovedId = data.id as string;
  await insertProposal(svc, { groomId, brideId, shadchanId: matchmakerId });
  const focus = await svc.from("student_admin_focus").insert({
    student_id: groomId,
    note: NOTE,
  });
  if (focus.error) throw new Error(`סימון מיקוד: ${focus.error.message}`);
});

test.afterAll(async () => {
  await deleteCards(svc, [groomId, brideId, unapprovedId].filter(Boolean));
});

test.describe("במיקוד: מנהל בלבד", () => {
  test("שדכן נדחה בנתיב המנהל, והסימון אינו משתנה", async ({ request }) => {
    // Act
    const response = await request.patch(
      `/api/v1/students/${brideId}/admin-focus`,
      { data: { focused: true, note: "ניסיון" } },
    );

    // Assert
    expect(response.status()).toBe(403);
    const { count } = await svc
      .from("student_admin_focus")
      .select("student_id", { count: "exact", head: true })
      .eq("student_id", brideId);
    expect(count).toBe(0);
  });

  test("שדכן ובעל הכרטיס אינם כותבים ואינם קוראים את הטבלה ישירות", async () => {
    for (const [label, client] of [
      ["שדכן", matchmaker],
      ["בעלים", owner],
    ] as const) {
      // Act
      const insert = await client
        .from("student_admin_focus")
        .insert({ student_id: brideId, note: "ניסיון" });
      const read = await client
        .from("student_admin_focus")
        .select("note")
        .eq("student_id", groomId);

      // Assert
      expect(insert.error, label).not.toBeNull();
      expect(read.error, label).not.toBeNull();
    }
  });

  test("הסימון גלוי לשדכן ב-view, ולא לבעל הכרטיס", async () => {
    // Act
    const asMatchmaker = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("admin_focus_at, admin_focus_note")
      .eq("id", groomId)
      .single();
    const asOwner = await owner
      .from(STUDENT_CARDS_VIEW)
      .select("admin_focus_at, admin_focus_note")
      .eq("id", groomId)
      .single();

    // Assert
    expect(asMatchmaker.data?.admin_focus_at).not.toBeNull();
    expect(asMatchmaker.data?.admin_focus_note).toBe(NOTE);
    expect(asOwner.data).toEqual({
      admin_focus_at: null,
      admin_focus_note: null,
    });
  });

  test("הרשימה: 'כרטיסים במיקוד' מסנן, ובמיון ברירת המחדל הם ראשונים", async () => {
    // Act
    const focusedOnly = await buildStudentsPageQuery(
      matchmaker,
      { last_name: LAST, adminFocus: "true" },
      null,
      1,
    );
    const byDefault = await buildStudentsPageQuery(
      matchmaker,
      { last_name: LAST },
      null,
      1,
    );

    // Assert
    expect(focusedOnly.error).toBeNull();
    expect(
      ((focusedOnly.data ?? []) as unknown as JsonRecord[]).map((r) => r.id),
    ).toEqual([groomId]);
    const ids = ((byDefault.data ?? []) as unknown as JsonRecord[]).map(
      (r) => r.id,
    );
    expect(ids[0]).toBe(groomId);
    expect(ids).toContain(brideId);
  });

  test("ברשימה: תג 'במיקוד' רק לכרטיס שסומן", async ({ page }) => {
    // Act
    await page.goto("/app/students");
    await page.getByLabel("חיפוש חופשי").first().fill(LAST);

    // Assert
    const focusedRow = page.getByRole("row").filter({ hasText: "חתן" });
    await expect(focusedRow.getByTestId("admin-focus-badge")).toBeVisible();
    const brideRow = page.getByRole("row").filter({ hasText: "כלה" });
    await expect(brideRow.getByTestId("admin-focus-badge")).toHaveCount(0);
  });
});

test.describe("מספר ההצעות לכרטיס ברשימה", () => {
  test("לפי ההרשאה של כל כרטיס: מאושר - מספר, ממתין - null", async () => {
    // Arrange
    const { count: expected } = await svc
      .from("shidduch_events")
      .select("id", { count: "exact", head: true })
      .eq("student_id", groomId);

    // Act
    const { data, error } = await matchmaker.rpc("get_card_proposal_counts", {
      p_student_ids: [groomId, unapprovedId],
    });

    // Assert
    expect(error, error?.message).toBeNull();
    const byId = new Map(
      ((data ?? []) as JsonRecord[]).map((row) => [
        row.student_id,
        row.proposal_count,
      ]),
    );
    expect(expected ?? 0).toBeGreaterThan(0);
    expect(byId.get(groomId)).toBe(expected);
    expect(byId.get(unapprovedId)).toBeNull();
  });

  test("גולש אינו מריץ את הפונקציה", async () => {
    // Arrange
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Act
    const { data, error } = await anon.rpc("get_card_proposal_counts", {
      p_student_ids: [groomId],
    });

    // Assert
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  test("העמודה ברשימה מציגה את המספר", async ({ page }) => {
    // Act
    await page.goto("/app/students");
    await page.getByLabel("חיפוש חופשי").first().fill(LAST);

    // Assert
    const row = page.getByRole("row").filter({ hasText: "חתן" });
    await expect(row.getByTestId("card-proposal-count")).toHaveText(/^\d+$/);
  });
});
