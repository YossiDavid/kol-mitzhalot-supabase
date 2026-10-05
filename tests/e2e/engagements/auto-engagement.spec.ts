import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * שידוך שסומן "הושלם" דרך PATCH /api/v1/shidduchim/status יוצר מודעת
 * אירוסין אוטומטית (לא מפורסמת, source='system'), ומסמן את שני הכרטיסים
 * כמאורסים. אידמפוטנטי: שמירה חוזרת או החלפה הלוך ושוב לא יוצרות שנייה.
 */
const STATUS_ENDPOINT = "/api/v1/shidduchim/status";
const FATHER_GROOM = "יעקב בדיקה";
const YESHIVA = "ישיבת בדיקה";
const SEMINARY = "סמינר בדיקה";

test.describe("שידוך שהושלם - מודעת אירוסין אוטומטית", () => {
  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let testUserId: string;
  let shidduchId: string;

  async function engagementsOfShidduch() {
    const { data, error } = await admin
      .from("engagements")
      .select("*")
      .eq("shidduch_id", shidduchId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function cleanEngagements() {
    await admin
      .from("engagements")
      .delete()
      .in("groom_student_id", [fx.groomFirst, fx.groomSecond]);
  }

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);

    await admin
      .from("students")
      .update({ parents_info: { father: { self: { name: FATHER_GROOM } } } })
      .eq("id", fx.groomFirst);
    await admin.from("education_history").insert([
      {
        student_id: fx.groomFirst,
        institution_type: "yeshiva_gdola",
        name: YESHIVA,
      },
      {
        student_id: fx.brideFirst,
        institution_type: "seminar",
        name: SEMINARY,
      },
    ]);

    shidduchId = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
  });

  test.afterAll(async () => {
    await cleanEngagements();
    await teardownShidduchFixtures(admin, fx);
  });

  test("סגירה יוצרת מודעה לא מפורסמת מנתוני הכרטיסים ומסמנת את הכרטיסים מאורסים", async ({
    request,
  }) => {
    // Arrange
    await cleanEngagements();

    // Act
    const res = await request.patch(STATUS_ENDPOINT, {
      data: { shidduchId, status: "completed" },
    });

    // Assert - תשובה
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).engagementWarning).toBe(false);

    // Assert - המודעה
    const rows = await engagementsOfShidduch();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "system",
      is_published: false,
      groom_student_id: fx.groomFirst,
      bride_student_id: fx.brideFirst,
      groom_name: "מיועד ראשון",
      bride_name: "מיועדת ראשונה",
      groom_father: FATHER_GROOM,
      bride_father: null,
      groom_city: "בני ברק",
      groom_yeshiva: YESHIVA,
      bride_seminary: SEMINARY,
    });
    expect(rows[0].closed_at).toBeTruthy();
    expect(rows[0].submitter_name).toContain("Test User");
    // פרטי הקשר של השדכן הפועל לעולם לא נשמרים במודעה (היא נקראת ציבורית)
    expect(rows[0].submitter_phone).toBeNull();
    expect(rows[0].submitter_email).toBeNull();
    expect(rows[0].shadchan_name).toContain("Test User");

    // Assert - הכרטיסים
    const { data: cards } = await admin
      .from("students")
      .select("id, personal_status, in_shidduchim")
      .in("id", [fx.groomFirst, fx.brideFirst]);
    expect(cards).toHaveLength(2);
    for (const card of cards ?? []) {
      expect(card.personal_status).toBe("engaged");
      expect(card.in_shidduchim).toBe(false);
    }
  });

  test("שמירה חוזרת של הושלם והחלפה הלוך ושוב אינן יוצרות מודעה שנייה", async ({
    request,
  }) => {
    // Arrange - המודעה כבר נוצרה בבדיקה הקודמת; מסמנים אותה כמפורסמת
    // כדי לוודא שגם עריכת המנהל לא נדרסת
    const [existing] = await engagementsOfShidduch();
    expect(existing).toBeTruthy();
    await admin
      .from("engagements")
      .update({ is_published: true })
      .eq("id", existing.id);

    // Act
    await request.patch(STATUS_ENDPOINT, {
      data: { shidduchId, status: "completed" },
    });
    await request.patch(STATUS_ENDPOINT, {
      data: { shidduchId, status: "in_progress" },
    });
    await request.patch(STATUS_ENDPOINT, {
      data: { shidduchId, status: "completed" },
    });

    // Assert
    const rows = await engagementsOfShidduch();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(existing.id);
    expect(rows[0].is_published).toBe(true);
  });

  test("סטטוס אחר מ-completed אינו יוצר מודעה", async ({ request }) => {
    // Arrange
    const otherId = await insertShidduch(admin, {
      groomId: fx.groomSecond,
      brideId: fx.brideSecond,
      shadchanId: testUserId,
    });

    // Act
    const res = await request.patch(STATUS_ENDPOINT, {
      data: { shidduchId: otherId, status: "interested" },
    });

    // Assert
    expect(res.ok()).toBeTruthy();
    const { count } = await admin
      .from("engagements")
      .select("id", { count: "exact", head: true })
      .eq("shidduch_id", otherId);
    expect(count).toBe(0);
  });
});
