import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CARD_MANAGER_EMAIL, clientAs } from "../chats/context-fixtures";
import { approvedCard } from "../helpers/approved-card";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * בעל כרטיס שעורך את הכרטיס או משנה תמונות -> התראה לכל מנהל
 * (card_updated / card_photos_changed), עם קישור לכרטיס. התראה אחת כל עוד
 * הקודמת לא נקראה. עריכה של שדכן, שינוי "פעיל בשידוכים" וכרטיס שעוד לא אושר -
 * בלי התראה.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);

let svc: SupabaseClient;
let owner: SupabaseClient;
let adminId = "";
let ownerId = "";
let cardId = "";
let pendingId = "";

async function seedCard(lastName: string, isApproved: boolean) {
  const row = {
    user_id: ownerId,
    first_name: "עריכה",
    last_name: lastName,
    birth_date: "1999-05-05",
    gender: "male",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
    in_shidduchim: true,
  };
  const { data, error } = await svc
    .from("students")
    .insert(isApproved ? approvedCard(row) : row)
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
  return data.id as string;
}

async function adminNotices(type: string, studentId = cardId) {
  const { data } = await svc
    .from("notifications")
    .select("id, link, read_at")
    .eq("user_id", adminId)
    .eq("type", type)
    .eq("related_id", studentId);
  return data ?? [];
}

test.describe("התראה למנהל על עריכת כרטיס ותמונות על ידי בעליו", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    svc = createServiceClient();
    adminId = await getTestUserId(svc, ADMIN_EMAIL);
    ownerId = await ensureCardManagerId(svc);
    owner = await clientAs(svc, CARD_MANAGER_EMAIL);
    cardId = await seedCard(`מאושר${T}`, true);
    pendingId = await seedCard(`ממתין${T}`, false);
  });

  test.afterAll(async () => {
    await svc.from("students").delete().in("id", [cardId, pendingId]);
    await svc
      .from("notifications")
      .delete()
      .in("related_id", [cardId, pendingId])
      .in("type", ["card_updated", "card_photos_changed"]);
  });

  test("עריכת פרטים: התראה אחת עם קישור, ועוד אחת רק אחרי שהקודמת נקראה", async () => {
    // Act
    const first = await owner
      .from("students")
      .update({ city: "ירושלים" })
      .eq("id", cardId);
    const second = await owner
      .from("students")
      .update({ city: "אלעד" })
      .eq("id", cardId);

    // Assert
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    const notices = await adminNotices("card_updated");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.link).toBe(`/app/students/${cardId}`);

    // Act: המנהל קרא, ובעל הכרטיס עורך שוב
    await svc
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notices[0]?.id ?? "");
    await owner.from("students").update({ city: "צפת" }).eq("id", cardId);

    // Assert
    expect(await adminNotices("card_updated")).toHaveLength(2);
  });

  test("שמירת הטבלאות המקושרות של הכרטיס (השכלה) שולחת התראה", async () => {
    // Arrange
    await svc
      .from("notifications")
      .delete()
      .eq("type", "card_updated")
      .eq("related_id", cardId);

    // Act
    const { error } = await owner.rpc("update_full_student_profile", {
      p_student_id: cardId,
      payload: {
        first_name: "עריכה",
        last_name: `מאושר${T}`,
        birth_date: "1999-05-05",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "צפת",
        education_history: [
          { institution_type: "yeshiva_gdola", name: `ישיבה${T}` },
        ],
      },
    });

    // Assert
    expect(error).toBeNull();
    expect(await adminNotices("card_updated")).toHaveLength(1);
  });

  test("שינוי 'פעיל בשידוכים', עריכה של שדכן וכרטיס ממתין - בלי התראה", async () => {
    // Arrange
    await svc
      .from("notifications")
      .delete()
      .eq("type", "card_updated")
      .in("related_id", [cardId, pendingId]);
    const shadchan = await clientAs(svc, TEST_USER_EMAIL);

    // Act
    await owner
      .from("students")
      .update({ in_shidduchim: false })
      .eq("id", cardId);
    await shadchan.rpc("update_full_student_profile", {
      p_student_id: cardId,
      payload: {
        first_name: "עריכה",
        last_name: `מאושר${T}`,
        birth_date: "1999-05-05",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "חיפה",
      },
    });
    await owner
      .from("students")
      .update({ city: "ירושלים" })
      .eq("id", pendingId);

    // Assert
    expect(await adminNotices("card_updated")).toHaveLength(0);
    expect(await adminNotices("card_updated", pendingId)).toHaveLength(0);
  });

  test("הוספה והסרה של תמונה: התראת תמונות אחת", async () => {
    // Act
    const added = await owner.rpc("set_student_photos", {
      p_student_id: cardId,
      p_paths: [`${cardId}/photos/a-${T}.jpg`],
    });
    const removed = await owner.rpc("set_student_photos", {
      p_student_id: cardId,
      p_paths: [],
    });

    // Assert
    expect(added.error).toBeNull();
    expect(removed.error).toBeNull();
    const notices = await adminNotices("card_photos_changed");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.link).toBe(`/app/students/${cardId}`);
    // מונה התמונות שהשתנה אינו נחשב "עריכת פרטים"
    expect(await adminNotices("card_updated")).toHaveLength(0);
  });
});
