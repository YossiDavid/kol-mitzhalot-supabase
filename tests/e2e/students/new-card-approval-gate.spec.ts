import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  ensureSecondParentId,
  insertProposal,
} from "../chats/context-fixtures";
import { approvedCard } from "../helpers/approved-card";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { STUDENT_TABLE_COLUMNS } from "../../../features/dashboard/lib/student-table-rows";
import { DESK_STUDENT_SELECT } from "../../../features/shidduchim/lib/desk-student-select";
import { buildStudentsPageQuery } from "../../../features/students/lib/students-list-query";
import { STUDENT_CARDS_VIEW } from "../../../features/students/lib/third-party-card";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * אישור הנהלה לכרטיס חדש, בשכבת המסד: כרטיס שנוצר בנתיב האמיתי
 * (create_full_student_profile בסשן של המשתמש, כמו POST /api/v1/students) ממתין
 * לאישור, ועד האישור הוא נקרא רק על ידי בעליו ומנהלים - בכל נתיב קריאה. כל
 * הקריאות בלקוח עם JWT אמיתי של המשתמש (RLS חל), בלי דפדפן.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const STAFF_EMAIL = "playwright-gate-staff@kol-mitzhalot.test";
const STAFF_PHONE = "+972500000047";
const T = `${Date.now()}`.slice(-8);
const LAST = `אישור${T}`;
const REJECTION_REASON = `סיבת-דחייה-חסויה-${T}`;
const FORBIDDEN_CODE = "42501";

const CHILD_TABLES = [
  "education_history",
  "employment_history",
  "previous_partners",
  "references",
  "partner_preferences",
  "medical_records",
] as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, what: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${what}: התקבל ערך שאינו אובייקט`);
  return value;
}

let svc: SupabaseClient;
let matchmaker: SupabaseClient;
let staff: SupabaseClient;
let parent: SupabaseClient;
let otherParent: SupabaseClient;
let adminUser: SupabaseClient;
let matchmakerId: string;
let parentId: string;
let otherParentId: string;
let adminId: string;
let staffId: string;
let institutionId = "";
/** נוצר על ידי הורה בנתיב האמיתי: ממתין */
let pendingId = "";
/** נוצר על ידי שדכן בנתיב האמיתי (צד שלישי): ממתין */
let matchmakerCardId = "";
/** נוצר על ידי מנהל בנתיב האמיתי: מאושר מיד */
let adminCardId = "";
/** צד שלישי שנוצר על ידי הורה אחר: ממתין, ואחר כך מאושר */
let thirdPartyId = "";
/** כרטיסים "מלפני ההטמעה": מאושרים */
let grandfatheredId = "";
let legacyId = "";
let brideId = "";
const cardIds: string[] = [];

function profilePayload(overrides: JsonRecord): JsonRecord {
  return {
    first_name: "חדש",
    last_name: LAST,
    birth_date: "2000-02-02",
    gender: "male",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
    card_for: "child",
    ...overrides,
  };
}

/** יצירה בנתיב של האפליקציה: ה-RPC בסשן של המשתמש עצמו */
async function createThroughApp(
  client: SupabaseClient,
  overrides: JsonRecord,
): Promise<string> {
  const { data, error } = await client.rpc("create_full_student_profile", {
    payload: profilePayload(overrides),
  });
  if (error || typeof data !== "string") {
    throw new Error(`יצירת כרטיס בנתיב האמיתי נכשלה: ${error?.message}`);
  }
  cardIds.push(data);
  return data;
}

async function approvalOf(studentId: string): Promise<JsonRecord> {
  const { data, error } = await svc
    .from("students")
    .select(
      "admin_approved_at, admin_approved_by, admin_rejected_at, admin_rejected_by, admin_rejection_reason",
    )
    .eq("id", studentId)
    .single();
  expect(error, error?.message).toBeNull();
  return asRecord(data, "עמודות האישור");
}

/** מה שנתיב המנהל עושה (PATCH /api/v1/students/:id/approval), ב-service role */
async function adminApproves(studentId: string) {
  const { error } = await svc
    .from("students")
    .update({
      admin_approved_at: new Date().toISOString(),
      admin_approved_by: adminId,
      admin_rejected_at: null,
      admin_rejected_by: null,
      admin_rejection_reason: null,
    })
    .eq("id", studentId);
  if (error) throw new Error(`אישור הכרטיס נכשל: ${error.message}`);
}

async function adminRejects(studentId: string, reason: string) {
  const { error } = await svc
    .from("students")
    .update({
      admin_approved_at: null,
      admin_approved_by: null,
      admin_rejected_at: new Date().toISOString(),
      admin_rejected_by: adminId,
      admin_rejection_reason: reason,
    })
    .eq("id", studentId);
  if (error) throw new Error(`דחיית הכרטיס נכשלה: ${error.message}`);
}

async function notificationCount(
  userId: string,
  type: string,
  studentId: string,
): Promise<number> {
  const { count, error } = await svc
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .eq("related_id", studentId);
  expect(error, error?.message).toBeNull();
  return count ?? 0;
}

async function userIdByEmail(email: string): Promise<string> {
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`לא נמצא משתמש בדיקה: ${email}`);
  return user.id;
}

async function ensureStaffId(): Promise<string> {
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users.find((user) => user.email === STAFF_EMAIL);
  if (existing) return existing.id;
  const { data, error } = await svc.auth.admin.createUser({
    email: STAFF_EMAIL,
    phone: STAFF_PHONE,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles: ["staff"] },
    user_metadata: { firstName: "Gate", lastName: "Staff" },
  });
  if (error || !data.user) {
    throw new Error(`יצירת איש צוות לבדיקה נכשלה: ${error?.message}`);
  }
  return data.user.id;
}

/** איש צוות מאושר, משויך למוסד שהכרטיסים הנבדקים שייכים אליו */
async function setupStaff(): Promise<void> {
  staffId = await ensureStaffId();
  const { data: institution, error } = await svc
    .from("institutions")
    .insert({
      name: `מוסד אישור ${T}`,
      gender: "male",
      type: "yeshiva_gedola",
    })
    .select("id")
    .single();
  if (error || !institution) {
    throw new Error(`יצירת מוסד לבדיקה נכשלה: ${error?.message}`);
  }
  institutionId = institution.id as string;
  const staffInfo = await svc.from("staff_info").upsert(
    {
      user_id: staffId,
      institution_id: institutionId,
      application_status: "approved",
    },
    { onConflict: "user_id" },
  );
  if (staffInfo.error) throw new Error(staffInfo.error.message);
  const link = await svc
    .from("staff_institutions")
    .upsert(
      { user_id: staffId, institution_id: institutionId },
      { onConflict: "user_id,institution_id" },
    );
  if (link.error) throw new Error(link.error.message);
}

async function seedApproved(row: JsonRecord): Promise<string> {
  const { data, error } = await svc
    .from("students")
    .insert(
      approvedCard({
        first_name: "קיים",
        last_name: LAST,
        birth_date: "1999-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        ...row,
      }),
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`זריעת כרטיס נכשלה: ${error?.message}`);
  cardIds.push(data.id as string);
  return data.id as string;
}

/** כל נתיבי הקריאה של מי שאינו בעל הכרטיס ואינו מנהל: אף אחד אינו מחזיר דבר */
async function expectHiddenFrom(
  label: string,
  client: SupabaseClient,
  viewerId: string,
  studentId: string,
  ownerId: string,
) {
  const direct = await client.from("students").select("*").eq("id", studentId);
  const byName = await client
    .from("students")
    .select("id")
    .eq("last_name", LAST)
    .eq("id", studentId);
  const view = await client
    .from(STUDENT_CARDS_VIEW)
    .select("*")
    .eq("id", studentId);
  const list = await buildStudentsPageQuery(
    client,
    { last_name: LAST },
    { key: "created", direction: "asc" },
    1,
  );
  const desk = await client
    .from(STUDENT_CARDS_VIEW)
    .select(DESK_STUDENT_SELECT)
    .in("id", [studentId]);
  const dashboard = await client
    .from(STUDENT_CARDS_VIEW)
    .select(STUDENT_TABLE_COLUMNS)
    .in("id", [studentId]);
  const chatMenu = await client
    .from(STUDENT_CARDS_VIEW)
    .select("id, first_name, last_name")
    .eq("user_id", ownerId)
    .eq("id", studentId);
  const thumbnails = await client
    .from(STUDENT_CARDS_VIEW)
    .select("id, gender, photo_count")
    .in("id", [studentId]);
  const communities = await client
    .from("students")
    .select("community")
    .eq("id", studentId);

  for (const [what, result] of [
    ["students *", direct],
    ["students לפי שם", byName],
    ["student_cards", view],
    ["לוח", desk],
    ["דשבורד/מועדפים", dashboard],
    ["תפריט כרטיסים בצ'אט", chatMenu],
    ["תמונות ממוזערות", thumbnails],
    ["אפשרויות קהילה", communities],
  ] as const) {
    expect(
      result.error,
      `${label} ${what}: ${result.error?.message}`,
    ).toBeNull();
    expect(result.data, `${label} ${what}`).toEqual([]);
  }
  expect(list.error, `${label} רשימה: ${list.error?.message}`).toBeNull();
  const listedIds = (list.data ?? []).map((row) => asRecord(row, "שורה").id);
  expect(listedIds, `${label} רשימה`).not.toContain(studentId);

  for (const table of CHILD_TABLES) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("student_id", studentId);
    expect(error, `${label} ${table}: ${error?.message}`).toBeNull();
    expect(data, `${label} ${table}`).toEqual([]);
  }

  const access = await client.rpc("get_student_card_access", {
    sid: studentId,
  });
  expect(access.data, `${label} רמת גישה`).toEqual([
    { access_level: "none", share_contact: false, share_medical: false },
  ]);
  const report = await client.rpc("report_student_card", {
    p_student_id: studentId,
    p_reason: "wrong_details",
    p_details: null,
  });
  expect(report.data, `${label} דיווח`).toBe("card_not_visible");
  const photo = await client.rpc("can_view_student_photo", {
    uid: viewerId,
    sid: studentId,
  });
  expect(photo.data, `${label} תמונה`).toBe(false);
  const feedback = await client.rpc("get_student_staff_feedback", {
    p_student_id: studentId,
  });
  expect(feedback.data ?? [], `${label} פידבק צוות`).toEqual([]);
  const proposalCard = await client.rpc("get_proposal_student_card", {
    p_student_id: studentId,
  });
  expect(proposalCard.data, `${label} כרטיס בהצעה`).toBeNull();
}

test.describe("אישור הנהלה לכרטיס חדש (מסד)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    svc = createServiceClient();
    matchmakerId = await getTestUserId(svc);
    otherParentId = await ensureCardManagerId(svc);
    parentId = await ensureSecondParentId(svc);
    adminId = await userIdByEmail(ADMIN_EMAIL);
    await setupStaff();

    matchmaker = await clientAs(svc, TEST_USER_EMAIL);
    staff = await clientAs(svc, STAFF_EMAIL);
    parent = await clientAs(svc, SECOND_PARENT_EMAIL);
    otherParent = await clientAs(svc, CARD_MANAGER_EMAIL);
    adminUser = await clientAs(svc, ADMIN_EMAIL);

    grandfatheredId = await seedApproved({
      user_id: otherParentId,
      card_for: "child",
      institution_id: institutionId,
    });
    legacyId = await seedApproved({ user_id: otherParentId, card_for: null });
    brideId = await seedApproved({
      user_id: parentId,
      card_for: "child",
      gender: "female",
      first_name: "כלה",
    });
  });

  test.afterAll(async () => {
    await deleteCards(svc, cardIds);
    await svc.from("staff_institutions").delete().eq("user_id", staffId);
    await svc.from("staff_info").delete().eq("user_id", staffId);
    if (institutionId) {
      await svc.from("institutions").delete().eq("id", institutionId);
    }
  });

  test("יצירה בנתיב האמיתי: הורה ושדכן - ממתין; מנהל - מאושר מיד; ה-payload אינו קובע אישור", async () => {
    // Act
    pendingId = await createThroughApp(parent, {
      institution_id: institutionId,
      // ניסיון לאשר לעצמי דרך ה-payload
      admin_approved_at: new Date().toISOString(),
      admin_approved_by: parentId,
    });
    matchmakerCardId = await createThroughApp(matchmaker, {
      card_for: "other",
      first_name: "שלישי",
    });
    thirdPartyId = await createThroughApp(otherParent, {
      card_for: "other",
      first_name: "שלישי-הורה",
      gender: "female",
    });
    adminCardId = await createThroughApp(adminUser, { first_name: "מנהל" });
    const directInsert = await parent
      .from("students")
      .insert({
        ...profilePayload({ first_name: "ישיר" }),
        user_id: parentId,
        admin_approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (directInsert.data) cardIds.push(String(directInsert.data.id));

    // Assert
    const pendingState = {
      admin_approved_at: null,
      admin_approved_by: null,
      admin_rejected_at: null,
      admin_rejected_by: null,
      admin_rejection_reason: null,
    };
    expect(await approvalOf(pendingId)).toEqual(pendingState);
    expect(await approvalOf(matchmakerCardId)).toEqual(pendingState);
    expect(await approvalOf(thirdPartyId)).toEqual(pendingState);
    const adminCard = await approvalOf(adminCardId);
    expect(adminCard.admin_approved_at).not.toBeNull();
    expect(adminCard.admin_approved_by).toBe(adminId);
    // הוספה ישירה לטבלה עם אישור: נשמרת ממתינה
    expect(directInsert.error, directInsert.error?.message).toBeNull();
    expect(await approvalOf(String(directInsert.data?.id))).toEqual(
      pendingState,
    );
  });

  test("התראה אחת למנהל על כל כרטיס חדש: סוג אחד לכרטיס רגיל, הקיים לכרטיס צד שלישי", async () => {
    expect(
      await notificationCount(adminId, "card_pending_approval", pendingId),
    ).toBe(1);
    expect(
      await notificationCount(adminId, "third_party_card_created", pendingId),
    ).toBe(0);
    // כרטיס צד שלישי: ההתראה הקיימת בלבד
    expect(
      await notificationCount(
        adminId,
        "third_party_card_created",
        thirdPartyId,
      ),
    ).toBe(1);
    expect(
      await notificationCount(adminId, "card_pending_approval", thirdPartyId),
    ).toBe(0);
    // כרטיס שמנהל יצר מאושר מיד, ואין על מה להתריע
    expect(
      await notificationCount(adminId, "card_pending_approval", adminCardId),
    ).toBe(0);
  });

  test("כרטיס ממתין: שדכן, איש צוות והורה אחר אינם מקבלים דבר, בשום נתיב קריאה", async () => {
    // Arrange: שורות בטבלאות המקושרות, כדי שיהיה מה להסתיר
    for (const [table, row] of [
      ["education_history", { institution_type: "yeshiva_gdola", name: "י" }],
      ["references", { reference_type: "friend", name: "מ", phone: "050" }],
      ["partner_preferences", { about_partner: "מחפש" }],
    ] as const) {
      const { error } = await svc
        .from(table)
        .insert({ student_id: pendingId, ...row });
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    // Act + Assert
    await expectHiddenFrom(
      "שדכן",
      matchmaker,
      matchmakerId,
      pendingId,
      parentId,
    );
    await expectHiddenFrom("איש צוות", staff, staffId, pendingId, parentId);
    await expectHiddenFrom(
      "הורה אחר",
      otherParent,
      otherParentId,
      pendingId,
      parentId,
    );
    // גם כרטיס שהשדכן עצמו יצר חבוי מכל מי שאינו הוא
    await expectHiddenFrom(
      "איש צוות, כרטיס של שדכן",
      staff,
      staffId,
      matchmakerCardId,
      matchmakerId,
    );
  });

  test("כרטיס ממתין: אין הצעה (גם לא טיוטה), אין שרשור צ'אט, אין עריכה, הערה או בקשת תמונה מצד שדכן", async () => {
    // Act
    const draft = await matchmaker.from("shidduchim").insert({
      groom_id: pendingId,
      bride_id: brideId,
      shadchan_id: matchmakerId,
      status: "draft",
    });
    const sent = await svc.from("shidduchim").insert({
      groom_id: pendingId,
      bride_id: brideId,
      shadchan_id: matchmakerId,
      status: "sent",
      recipient_scope: "both",
      sent_at: new Date().toISOString(),
    });
    const room = await matchmaker.rpc("get_or_create_context_room", {
      other_user_id: parentId,
      p_context_kind: "student",
      p_student_id: pendingId,
      p_shidduch_id: null,
    });
    const edit = await matchmaker.rpc("update_full_student_profile", {
      p_student_id: pendingId,
      payload: profilePayload({ first_name: "נערך-על-ידי-שדכן" }),
    });
    const note = await matchmaker.from("student_notes").insert({
      student_id: pendingId,
      author_id: matchmakerId,
      author_role: "shadchan",
      body: "הערה על כרטיס חבוי",
    });
    const photoRequest = await matchmaker.from("photo_view_requests").insert({
      student_id: pendingId,
      requester_id: matchmakerId,
      status: "pending",
    });
    const { data: name } = await svc
      .from("students")
      .select("first_name")
      .eq("id", pendingId)
      .single();

    // Assert
    expect(draft.error?.message).toContain("card_pending_approval");
    expect(draft.error?.details).toBe("groom");
    expect(sent.error?.message).toContain("card_pending_approval");
    expect(room.error?.message).toContain("context_not_allowed");
    expect(edit.error).not.toBeNull();
    expect(name?.first_name).toBe("חדש");
    expect(note.error?.code).toBe(FORBIDDEN_CODE);
    expect(photoRequest.error?.code).toBe(FORBIDDEN_CODE);
  });

  test("גולש לא מחובר: אינו קורא את הכרטיס הממתין", async () => {
    // Arrange
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Act
    const direct = await anon.from("students").select("id").eq("id", pendingId);
    const feedback = await anon.rpc("get_student_staff_feedback", {
      p_student_id: pendingId,
    });

    // Assert
    expect(direct.data ?? []).toEqual([]);
    expect(feedback.data ?? []).toEqual([]);
  });

  test("בעל הכרטיס ומנהל: קוראים הכול, ובעל הכרטיס ממשיך לערוך", async () => {
    for (const [label, client] of [
      ["בעלים", parent],
      ["מנהל", adminUser],
    ] as const) {
      // Act
      const direct = await client
        .from("students")
        .select("id, first_name, admin_approved_at, references(name)")
        .eq("id", pendingId)
        .single();
      const view = await client
        .from(STUDENT_CARDS_VIEW)
        .select("id, admin_approved_at, admin_rejected_at")
        .eq("id", pendingId)
        .single();
      const access = await client.rpc("get_student_card_access", {
        sid: pendingId,
      });

      // Assert
      expect(direct.error, `${label}: ${direct.error?.message}`).toBeNull();
      expect(asRecord(direct.data, label).references).toEqual([{ name: "מ" }]);
      expect(view.data, label).toEqual({
        id: pendingId,
        admin_approved_at: null,
        admin_rejected_at: null,
      });
      expect(asRecord(access.data?.[0], label).access_level).toBe("full");
    }

    const edit = await parent.rpc("update_full_student_profile", {
      p_student_id: pendingId,
      payload: profilePayload({
        first_name: "נערך",
        institution_id: institutionId,
        // גם העריכה אינה קובעת אישור
        admin_approved_at: new Date().toISOString(),
      }),
    });
    expect(edit.error, edit.error?.message).toBeNull();
    const state = await approvalOf(pendingId);
    expect(state.admin_approved_at).toBeNull();
    expect(state.admin_rejected_at).toBeNull();
  });

  test("בעל הכרטיס אינו קובע את עמודות האישור בעדכון ישיר", async () => {
    // Act
    const approve = await parent
      .from("students")
      .update({ admin_approved_at: new Date().toISOString() })
      .eq("id", pendingId);
    const approveBy = await parent
      .from("students")
      .update({ admin_approved_by: parentId })
      .eq("id", pendingId);
    const reject = await parent
      .from("students")
      .update({
        admin_rejected_at: new Date().toISOString(),
        admin_rejection_reason: "דחיתי לעצמי",
      })
      .eq("id", pendingId);
    // כרטיס מאושר: בעליו אינו מחזיר אותו ל"ממתין"
    const unapprove = await parent
      .from("students")
      .update({ admin_approved_at: null })
      .eq("id", brideId);

    // Assert
    for (const result of [approve, approveBy, reject, unapprove]) {
      expect(result.error?.code).toBe(FORBIDDEN_CODE);
    }
    expect((await approvalOf(pendingId)).admin_approved_at).toBeNull();
    expect((await approvalOf(brideId)).admin_approved_at).not.toBeNull();
  });

  test("ה-view והטבלה: אותן שורות לכל צופה, וכרטיס שאינו מאושר רק לבעליו ולמנהל", async () => {
    const { data: unapproved } = await svc
      .from("students")
      .select("id, user_id")
      .is("admin_approved_at", null)
      .is("deleted_at", null);
    const unapprovedRows = unapproved ?? [];
    expect(unapprovedRows.map((row) => row.id)).toContain(pendingId);

    for (const [email, viewerId, isAdmin] of [
      [TEST_USER_EMAIL, matchmakerId, false],
      [STAFF_EMAIL, staffId, false],
      [CARD_MANAGER_EMAIL, otherParentId, false],
      [SECOND_PARENT_EMAIL, parentId, false],
      [ADMIN_EMAIL, adminId, true],
    ] as const) {
      // Arrange
      const client = await clientAs(svc, email);

      // Act
      const table = await client.from("students").select("id");
      const view = await client.from(STUDENT_CARDS_VIEW).select("id");
      const fromTable = (table.data ?? []).map((row) => String(row.id));
      const fromView = (view.data ?? []).map((row) => String(row.id));

      // Assert: כל מה שבטבלה נמצא גם ב-view
      expect(
        fromTable.filter((id) => !fromView.includes(id)),
        email,
      ).toEqual([]);
      // כרטיס שאינו מאושר מופיע רק לבעליו ולמנהל - בטבלה וב-view כאחד
      for (const row of unapprovedRows) {
        const expected = isAdmin || row.user_id === viewerId;
        expect(fromTable.includes(row.id), `${email} טבלה ${row.id}`).toBe(
          expected,
        );
        expect(fromView.includes(row.id), `${email} view ${row.id}`).toBe(
          expected,
        );
      }
      // כרטיסים מאושרים שרק ה-view מציג: רק צד שלישי שלא אושר להצגה מלאה
      const onlyInView = fromView.filter((id) => !fromTable.includes(id));
      if (onlyInView.length > 0) {
        const { data: extra } = await svc
          .from("students")
          .select("card_for, third_party_full_display_approved_at")
          .in("id", onlyInView);
        for (const row of extra ?? []) {
          expect(row.card_for, email).toBe("other");
          expect(row.third_party_full_display_approved_at, email).toBeNull();
        }
      }
    }
  });

  test("כרטיסים מלפני ההטמעה (כולל card_for ריק): השדכן ואיש הצוות רואים כמו תמיד", async () => {
    // Act
    const direct = await matchmaker
      .from("students")
      .select("id")
      .in("id", [grandfatheredId, legacyId]);
    const staffDirect = await staff
      .from("students")
      .select("id")
      .eq("id", grandfatheredId);
    const list = await buildStudentsPageQuery(
      matchmaker,
      { last_name: LAST },
      null,
      1,
    );

    // Assert
    expect((direct.data ?? []).map((row) => row.id).sort()).toEqual(
      [grandfatheredId, legacyId].sort(),
    );
    expect(staffDirect.data).toEqual([{ id: grandfatheredId }]);
    const listed = (list.data ?? []).map((row) => asRecord(row, "שורה").id);
    expect(listed).toEqual(
      expect.arrayContaining([grandfatheredId, legacyId, adminCardId]),
    );
    expect(listed).not.toContain(pendingId);
  });

  test("המנהל מאשר: הכרטיס נראה לשדכן ולאיש הצוות כמו כל כרטיס, והבעלים מקבל התראה", async () => {
    // Act
    await adminApproves(pendingId);
    const direct = await matchmaker
      .from("students")
      .select("id, first_name, references(name)")
      .eq("id", pendingId)
      .single();
    const staffDirect = await staff
      .from("students")
      .select("id")
      .eq("id", pendingId);
    const list = await buildStudentsPageQuery(
      matchmaker,
      { last_name: LAST, newCards: "today" },
      { key: "created", direction: "asc" },
      1,
    );
    const access = await matchmaker.rpc("get_student_card_access", {
      sid: pendingId,
    });
    const draft = await matchmaker
      .from("shidduchim")
      .insert({
        groom_id: pendingId,
        bride_id: brideId,
        shadchan_id: matchmakerId,
        status: "draft",
      })
      .select("id")
      .single();

    // Assert
    expect(direct.error, direct.error?.message).toBeNull();
    expect(direct.data).toEqual({
      id: pendingId,
      first_name: "נערך",
      references: [{ name: "מ" }],
    });
    expect(staffDirect.data).toEqual([{ id: pendingId }]);
    // "חדש היום" נמדד מרגע האישור
    const listed = (list.data ?? []).map((row) => asRecord(row, "שורה").id);
    expect(listed).toContain(pendingId);
    expect(asRecord(access.data?.[0], "גישה").access_level).toBe("full");
    expect(draft.error, draft.error?.message).toBeNull();
    expect(await notificationCount(parentId, "card_approved", pendingId)).toBe(
      1,
    );
  });

  test("כרטיס צד שלישי שאושר: מתנהג כצד שלישי שטרם אושר להצגה מלאה (נתונים בסיסיים דרך ה-view)", async () => {
    // Arrange
    const about = `אודות-צד-שלישי-${T}`;
    await svc.from("students").update({ about }).eq("id", thirdPartyId);
    const hiddenBefore = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("id", thirdPartyId);

    // Act
    await adminApproves(thirdPartyId);
    const direct = await matchmaker
      .from("students")
      .select("id, about")
      .eq("id", thirdPartyId);
    const view = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("*")
      .eq("id", thirdPartyId)
      .single();

    // Assert
    expect(hiddenBefore.data).toEqual([]);
    expect(direct.data).toEqual([]);
    const row = asRecord(view.data, "student_cards");
    expect(row.card_for).toBe("other");
    expect(row.third_party_full_display_approved_at).toBeNull();
    expect(row.admin_approved_at).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain(about);
  });

  test("המנהל דוחה עם סיבה: הכרטיס חבוי, הבעלים רואה את הסיבה, ואף אחד אחר אינו קורא אותה", async () => {
    // Arrange: סיבה היא חובה
    const noReason = await svc
      .from("students")
      .update({ admin_rejected_at: new Date().toISOString() })
      .eq("id", matchmakerCardId);

    // Act
    await adminRejects(matchmakerCardId, REJECTION_REASON);
    const owner = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("admin_approved_at, admin_rejected_at, admin_rejection_reason")
      .eq("id", matchmakerCardId)
      .single();

    // Assert
    expect(noReason.error).not.toBeNull();
    expect(asRecord(owner.data, "בעלים").admin_rejection_reason).toBe(
      REJECTION_REASON,
    );
    expect(asRecord(owner.data, "בעלים").admin_rejected_at).not.toBeNull();
    await expectHiddenFrom(
      "איש צוות, כרטיס שנדחה",
      staff,
      staffId,
      matchmakerCardId,
      matchmakerId,
    );
    await expectHiddenFrom(
      "הורה, כרטיס שנדחה",
      parent,
      parentId,
      matchmakerCardId,
      matchmakerId,
    );
    expect(
      await notificationCount(matchmakerId, "card_rejected", matchmakerCardId),
    ).toBe(1);
  });

  test("כרטיס שאושר ואז נדחה: מי שקיבל עליו הצעה אינו רואה אותו עוד, ולא את סיבת הדחייה", async () => {
    // Arrange: הצעה שנשלחה כשהכרטיס היה מאושר
    await insertProposal(svc, {
      groomId: grandfatheredId,
      brideId,
      shadchanId: matchmakerId,
    });
    const before = await parent.rpc("get_proposal_student_card", {
      p_student_id: grandfatheredId,
    });

    // Act
    await adminRejects(grandfatheredId, REJECTION_REASON);
    const after = await parent.rpc("get_proposal_student_card", {
      p_student_id: grandfatheredId,
    });
    const access = await parent.rpc("get_student_card_access", {
      sid: grandfatheredId,
    });
    const proposals = await parent.rpc("get_my_shidduch_proposals", {});
    const asMatchmaker = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("*")
      .eq("id", grandfatheredId);

    // Assert
    expect(asRecord(before.data, "לפני הדחייה").id).toBe(grandfatheredId);
    expect(after.data).toBeNull();
    expect(asRecord(access.data?.[0], "גישה").access_level).toBe("none");
    const mine = (proposals.data ?? []).map((row: unknown) =>
      asRecord(row, "הצעה"),
    );
    const proposal = mine.find(
      (row: JsonRecord) => row.my_student_id === brideId,
    );
    expect(proposal).toBeDefined();
    expect(proposal?.other_first_name).toBeNull();
    expect(asMatchmaker.data).toEqual([]);
    for (const payload of [after.data, proposals.data, asMatchmaker.data]) {
      expect(JSON.stringify(payload)).not.toContain(REJECTION_REASON);
    }
    // מחזירים למצב מאושר לשאר הבדיקות
    await adminApproves(grandfatheredId);
  });

  test("שליחה לאישור מחדש: בעל כרטיס שנדחה מחזיר אותו לממתין, והמנהלים מקבלים התראה אחת", async () => {
    // Arrange
    const before = await notificationCount(
      adminId,
      "card_pending_approval",
      matchmakerCardId,
    );
    const stranger = await staff
      .from("students")
      .update({
        admin_rejected_at: null,
        admin_rejected_by: null,
        admin_rejection_reason: null,
      })
      .eq("id", matchmakerCardId)
      .select("id");

    // Act: מה ש-POST /api/v1/students/:id/approval עושה, בסשן של בעל הכרטיס
    const resubmit = await matchmaker
      .from("students")
      .update({
        admin_approved_at: null,
        admin_approved_by: null,
        admin_rejected_at: null,
        admin_rejected_by: null,
        admin_rejection_reason: null,
      })
      .eq("id", matchmakerCardId)
      .select("id");

    // Assert
    expect(stranger.data ?? []).toEqual([]);
    expect(resubmit.error, resubmit.error?.message).toBeNull();
    expect(resubmit.data).toEqual([{ id: matchmakerCardId }]);
    expect(await approvalOf(matchmakerCardId)).toEqual({
      admin_approved_at: null,
      admin_approved_by: null,
      admin_rejected_at: null,
      admin_rejected_by: null,
      admin_rejection_reason: null,
    });
    expect(
      await notificationCount(
        adminId,
        "card_pending_approval",
        matchmakerCardId,
      ),
    ).toBe(before + 1);
    await expectHiddenFrom(
      "איש צוות, אחרי שליחה מחדש",
      staff,
      staffId,
      matchmakerCardId,
      matchmakerId,
    );
  });
});
