import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
  pageAs,
} from "../chats/context-fixtures";
import {
  GATE_STAFF_EMAIL,
  setupInstitutionStaff,
} from "../helpers/institution-staff";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { STUDENT_CARDS_VIEW } from "../../../features/students/lib/third-party-card";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * מספר ת.ז. של מיועד/ת: הערכים שנאספו בעבר נמצאים ב-student_identity_numbers
 * (בעל הכרטיס ומנהל בלבד), ו-students.identity_number ריק תמיד. אף אחד אחר אינו
 * מקבל את המספר בשום נתיב, ושמירת כרטיס בנתיבים האמיתיים אינה משנה ואינה מוחקת
 * אותו. כל הקריאות בלקוח עם JWT אמיתי של המשתמש (RLS חל).
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const T = `${Date.now()}`.slice(-8);
const LAST = `תז${T}`;
const IDENTITY = `3${T}3`;
const FORGED_IDENTITY = `4${T}4`;

let admin: SupabaseClient;
let shadchanId: string;
let ownerId: string;
let groomId = "";
let brideId = "";
let institutionId = "";
let cleanupStaff: () => Promise<void> = async () => {};
const extraCards: string[] = [];

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "מיועד",
    last_name: LAST,
    birth_date: "1999-09-09",
    gender: "male",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
    card_for: "child",
    institution_id: institutionId,
    ...overrides,
  };
}

async function storedIdentity(studentId: string) {
  const [{ data: row }, { data: side }, { count }] = await Promise.all([
    admin
      .from("students")
      .select("identity_number")
      .eq("id", studentId)
      .single(),
    admin
      .from("student_identity_numbers")
      .select("identity_number")
      .eq("student_id", studentId)
      .maybeSingle(),
    admin
      .from("student_identity_numbers")
      .select("student_id", { count: "exact", head: true }),
  ]);
  return {
    onCard: row?.identity_number ?? null,
    stored: side?.identity_number ?? null,
    total: count ?? 0,
  };
}

async function everythingAbout(
  client: SupabaseClient,
  studentId: string,
): Promise<unknown[]> {
  const results = await Promise.all([
    client.from("students").select("*").eq("id", studentId),
    client.from("students").select("identity_number").eq("id", studentId),
    client.from("students").select("id").eq("identity_number", IDENTITY),
    client.from(STUDENT_CARDS_VIEW).select("*").eq("id", studentId),
    client
      .from("student_identity_numbers")
      .select("*")
      .eq("student_id", studentId),
    client.rpc("get_proposal_student_card", { p_student_id: studentId }),
  ]);
  return results.map((result) => result.data ?? null);
}

test.describe("מספר ת.ז. של מיועד/ת (מסד)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    ownerId = await ensureCardManagerId(admin);
    const parentId = await ensureSecondParentId(admin);
    const staff = await setupInstitutionStaff(admin, `תז ${T}`);
    institutionId = staff.institutionId;
    cleanupStaff = staff.cleanup;

    groomId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "מיועד",
      lastName: LAST,
    });
    brideId = await createCard(admin, {
      userId: parentId,
      gender: "female",
      firstName: "כלה",
      lastName: LAST,
    });
    const placed = await admin
      .from("students")
      .update({ institution_id: institutionId })
      .eq("id", groomId);
    if (placed.error) throw new Error(placed.error.message);
    // מספר שנאסף בעבר: נמצא בטבלה הנפרדת בלבד
    const stored = await admin
      .from("student_identity_numbers")
      .insert({ student_id: groomId, identity_number: IDENTITY });
    if (stored.error) throw new Error(stored.error.message);
    // הצד השני בהצעה: מי שצופה בכרטיס דרך הצעה
    await insertProposal(admin, { groomId, brideId, shadchanId });
  });

  test.afterAll(async () => {
    await deleteCards(admin, [groomId, brideId, ...extraCards]);
    await cleanupStaff();
  });

  test("העמודה ב-students ריקה תמיד: גם כתיבה ישירה ב-service role נשמרת כ-NULL", async () => {
    // Act
    const write = await admin
      .from("students")
      .update({ identity_number: FORGED_IDENTITY })
      .eq("id", groomId);
    const { data: nonEmpty, error } = await admin
      .from("students")
      .select("id")
      .not("identity_number", "is", null);

    // Assert
    expect(write.error, write.error?.message).toBeNull();
    expect((await storedIdentity(groomId)).onCard).toBeNull();
    expect(error).toBeNull();
    expect(nonEmpty).toEqual([]);
  });

  test("שדכן, איש צוות של המוסד, הצד השני בהצעה וגולש לא מחובר אינם מקבלים את המספר", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const viewers: Array<[string, SupabaseClient]> = [
      ["שדכן", await clientAs(admin, TEST_USER_EMAIL)],
      ["איש צוות", await clientAs(admin, GATE_STAFF_EMAIL)],
      ["הצד השני בהצעה", await clientAs(admin, SECOND_PARENT_EMAIL)],
      ["גולש", anon],
    ];

    for (const [label, client] of viewers) {
      // Act
      const payloads = await everythingAbout(client, groomId);

      // Assert: סריקה של כל מה שחזר
      expect(JSON.stringify(payloads), label).not.toContain(IDENTITY);
    }

    // השדכן ואיש הצוות עדיין רואים את הכרטיס עצמו (אין כאן חסימה של הכרטיס)
    const matchmaker = await clientAs(admin, TEST_USER_EMAIL);
    const staff = await clientAs(admin, GATE_STAFF_EMAIL);
    for (const client of [matchmaker, staff]) {
      const { data } = await client
        .from("students")
        .select("id, identity_number")
        .eq("id", groomId);
      expect(data).toEqual([{ id: groomId, identity_number: null }]);
    }
  });

  test("בעל הכרטיס ומנהל קוראים את המספר מהטבלה הנפרדת", async () => {
    for (const email of [CARD_MANAGER_EMAIL, ADMIN_EMAIL]) {
      // Arrange
      const client = await clientAs(admin, email);

      // Act
      const { data, error } = await client
        .from("student_identity_numbers")
        .select("student_id, identity_number")
        .eq("student_id", groomId);

      // Assert
      expect(error, `${email}: ${error?.message}`).toBeNull();
      expect(data).toEqual([
        { student_id: groomId, identity_number: IDENTITY },
      ]);
    }
    // ואף אחד אינו כותב לטבלה בסשן משתמש
    const owner = await clientAs(admin, CARD_MANAGER_EMAIL);
    const write = await owner
      .from("student_identity_numbers")
      .update({ identity_number: FORGED_IDENTITY })
      .eq("student_id", groomId)
      .select("student_id");
    expect(write.data ?? []).toEqual([]);
  });

  test("שמירת כרטיס בנתיבים האמיתיים אינה משנה ואינה מוחקת את המספר", async ({
    browser,
  }) => {
    // Arrange
    const before = await storedIdentity(groomId);
    const owner = await pageAs(browser, admin, CARD_MANAGER_EMAIL, "/app");

    // Act: עריכה בלי המפתח, ועריכה עם מספר מזויף ב-payload
    const plain = await owner.request.put(
      `/api/v1/students/${groomId}/profile`,
      { headers: { Origin: BASE_URL }, data: { payload: profilePayload() } },
    );
    const forged = await owner.request.put(
      `/api/v1/students/${groomId}/profile`,
      {
        headers: { Origin: BASE_URL },
        data: { payload: profilePayload({ identity_number: FORGED_IDENTITY }) },
      },
    );
    // יצירה עם מספר ב-payload
    const created = await owner.request.post("/api/v1/students", {
      headers: { Origin: BASE_URL },
      data: { payload: profilePayload({ identity_number: FORGED_IDENTITY }) },
    });

    // Assert
    expect(plain.status(), await plain.text()).toBe(200);
    expect(forged.status(), await forged.text()).toBe(200);
    expect(created.status(), await created.text()).toBe(201);
    const createdId: string = (await created.json()).id;
    extraCards.push(createdId);
    const after = await storedIdentity(groomId);
    expect(after).toEqual({ ...before, onCard: null, stored: IDENTITY });
    const fresh = await storedIdentity(createdId);
    expect(fresh.onCard).toBeNull();
    expect(fresh.stored).toBeNull();
    expect(fresh.total).toBe(before.total);
    await owner.context().close();
  });
});
