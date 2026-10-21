import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { STUDENT_TABLE_COLUMNS } from "../../../features/dashboard/lib/student-table-rows";
import { DESK_STUDENT_SELECT } from "../../../features/shidduchim/lib/desk-student-select";
import { BASIC_STUDENT_SELECT } from "../../../features/students/lib/student-card-data";
import { buildStudentsPageQuery } from "../../../features/students/lib/students-list-query";
import { STUDENT_CARDS_VIEW } from "../../../features/students/lib/third-party-card";
import {
  SEEDED,
  deleteCards,
  grandfatherCard,
  seedFullCard,
} from "./third-party-card-fixtures";

/**
 * שער הכרטיס המוגבל, בשכבת המסד: כרטיס צד שלישי שלא אושר להצגה מלאה אינו נקרא
 * ישירות מ-students על ידי שדכן או איש צוות - לא עמודה אחת ממנו - והנתונים
 * הבסיסיים שלו מגיעים רק דרך student_cards. כל הקריאות בלקוח עם JWT אמיתי של
 * המשתמש (RLS חל), בלי דפדפן.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const STAFF_EMAIL = "playwright-gate-staff@kol-mitzhalot.test";
const STAFF_PHONE = "+972500000047";
const T = `${Date.now()}`.slice(-8);

/** ערכים מובחנים שמחוץ לנתונים הבסיסיים: אסור שיגיעו לשדכן או לאיש צוות */
const HIDDEN = {
  phone: `050${T}1`,
  street: `רחוב-מוגבל-${T}`,
  house: `4${T}`,
  identityNumber: `7${T}7`,
  fatherPhone: "0501119999",
} as const;
const HIDDEN_VALUES: readonly string[] = [
  ...Object.values(HIDDEN),
  SEEDED.about,
  SEEDED.fatherJob,
  SEEDED.motherJob,
  SEEDED.familyAbout,
  SEEDED.fillReason,
  SEEDED.referenceName,
  SEEDED.partnerAbout,
  SEEDED.previousPartnerName,
];

/**
 * סיווג כל העמודות של students מול ה-view. עמודה חדשה בטבלה שאינה באף אחת
 * משלוש הרשימות מפילה את הבדיקה, כך שההחלטה עליה מתקבלת במפורש - ובינתיים
 * היא אינה נחשפת: ה-view בנוי מרשימה מפורשת, ושורת students של כרטיס מוגבל
 * חסומה כולה.
 */
/** נתונים בסיסיים ועמודות תפעול: חוזרים מה-view כמות שהם גם בכרטיס מוגבל */
const VIEW_AS_IS = [
  "id",
  "user_id",
  "created_at",
  "first_name",
  "last_name",
  "nickname",
  "gender",
  "personal_status",
  "birth_date",
  "height",
  "country",
  "city",
  "community",
  "shtible",
  "cellphone_type",
  "cv_url",
  "in_shidduchim",
  "status_changed_at",
  "is_yeshiva",
  "photo_count",
  "institution_id",
  "deleted_at",
  "card_for",
  "third_party_full_display_approved_at",
  "third_party_proposals_approved_at",
  // רגע אישור ההנהלה: לפיו נמדד "חדש" ברשימה
  "admin_approved_at",
  // כהן: פרט בסיסי, כמו הסטטוס האישי
  "is_kohen",
] as const;
/**
 * קיימות ב-view, וחוזרות רק לבעל הכרטיס ולמנהל (לשדכן ולאיש צוות - ריקות
 * בכל כרטיס): הדחייה והסיבה שלה
 */
const VIEW_OWNER_AND_ADMIN_ONLY = [
  "admin_rejected_at",
  "admin_rejection_reason",
  // אישור "להצעות המנהל בלבד": למנהל בלבד (בעל הכרטיס רואה "מאושר")
  "admin_exclusive_at",
] as const;
/** קיימות ב-view, אבל ריקות בכרטיס מוגבל */
const VIEW_NULL_WHEN_RESTRICTED = [
  "plan_for_life",
  "head_cover_type",
  "proposal_limit_count",
  "proposal_limit_period",
  "admin_paused_at",
  "third_party_full_display_approved_by",
  "third_party_proposals_approved_by",
  "willing_to_live_countries",
  // שפת אם ושפות נוספות: כמו "מוכן/ה לגור ב", לא מהנתונים הבסיסיים
  "native_language",
  "languages",
] as const;
/**
 * קיימות ב-view ואינן עמודות של students (student_admin_focus): לשדכן ולמנהל
 * בלבד, ובשאר המקרים ריקות
 */
const VIEW_ONLY_COLUMNS = ["admin_focus_at", "admin_focus_note"] as const;
/** קיימות ב-view, ומצומצמות בכרטיס מוגבל (שמות הורים; בלי ההסבר של הממלא) */
const VIEW_REDUCED_WHEN_RESTRICTED = ["parents_info", "author_info"] as const;
/** אינן ב-view בכלל, לאף כרטיס */
const NEVER_IN_VIEW = [
  "identity_number",
  "phone",
  "street",
  "house",
  "about",
  "family_info",
  "image_url",
  "updated_at",
  "deleted_by",
  "admin_paused_by",
  "admin_approved_by",
  "admin_rejected_by",
  "admin_review_silent",
  "admin_exclusive_by",
] as const;

const SENSITIVE_CHILD_TABLES = [
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

function expectNoHiddenValues(value: unknown, label: string) {
  const json = JSON.stringify(value);
  for (const hidden of HIDDEN_VALUES) {
    expect(json, `${label}: דלף ${hidden}`).not.toContain(hidden);
  }
}

let admin: SupabaseClient;
let matchmaker: SupabaseClient;
let staff: SupabaseClient;
let matchmakerId: string;
let ownerId: string;
let staffId: string;
let institutionId = "";
let restrictedId = "";
let approvedId = "";
let legacyId = "";
let regularId = "";
let groomId = "";
const cardIds: string[] = [];
const RESTRICTED_LAST = `מוגבל${T}`;

async function ensureStaffId(): Promise<string> {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users.find((user) => user.email === STAFF_EMAIL);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
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
  const { data: institution, error } = await admin
    .from("institutions")
    .insert({ name: `מוסד שער ${T}`, gender: "female", type: "seminary" })
    .select("id")
    .single();
  if (error || !institution) {
    throw new Error(`יצירת מוסד לבדיקה נכשלה: ${error?.message}`);
  }
  institutionId = institution.id as string;
  const staffInfo = await admin.from("staff_info").upsert(
    {
      user_id: staffId,
      institution_id: institutionId,
      application_status: "approved",
    },
    { onConflict: "user_id" },
  );
  if (staffInfo.error) throw new Error(staffInfo.error.message);
  const link = await admin
    .from("staff_institutions")
    .upsert(
      { user_id: staffId, institution_id: institutionId },
      { onConflict: "user_id,institution_id" },
    );
  if (link.error) throw new Error(link.error.message);
}

async function mustUpdate(studentId: string, patch: JsonRecord) {
  const { error } = await admin
    .from("students")
    .update(patch)
    .eq("id", studentId);
  if (error) throw new Error(`עדכון כרטיס לבדיקה נכשל: ${error.message}`);
}

/** השורה כפי שהיא בטבלה (service role), להשוואה מול מה שה-view מחזיר */
async function tableRow(studentId: string): Promise<JsonRecord> {
  const { data, error } = await admin
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();
  expect(error, error?.message).toBeNull();
  return asRecord(data, "שורת students");
}

async function viewRow(
  client: SupabaseClient,
  studentId: string,
): Promise<JsonRecord> {
  const { data, error } = await client
    .from(STUDENT_CARDS_VIEW)
    .select("*")
    .eq("id", studentId)
    .single();
  expect(error, error?.message).toBeNull();
  return asRecord(data, "שורת student_cards");
}

async function visibleIds(
  client: SupabaseClient,
  relation: string,
): Promise<string[]> {
  const { data, error } = await client.from(relation).select("id");
  expect(error, error?.message).toBeNull();
  return (data ?? []).map((row) => String(row.id)).sort();
}

test.describe("שער הכרטיס המוגבל (מסד)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    matchmakerId = await getTestUserId(admin);
    ownerId = await ensureCardManagerId(admin);
    await ensureSecondParentId(admin);
    await setupStaff();

    restrictedId = await seedFullCard(admin, {
      ownerId,
      lastName: RESTRICTED_LAST,
    });
    approvedId = await seedFullCard(admin, {
      ownerId,
      lastName: `מאושר${T}`,
    });
    legacyId = await seedFullCard(admin, {
      ownerId,
      lastName: `ישן${T}`,
      cardFor: null,
    });
    regularId = await seedFullCard(admin, {
      ownerId,
      lastName: `רגיל${T}`,
      cardFor: "child",
    });
    groomId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "חתן",
      lastName: `שער-מוגבל${T}`,
    });
    cardIds.push(restrictedId, approvedId, legacyId, regularId, groomId);
    await grandfatherCard(admin, approvedId);

    for (const id of [restrictedId, approvedId, legacyId, regularId]) {
      await mustUpdate(id, {
        phone: HIDDEN.phone,
        street: HIDDEN.street,
        house: HIDDEN.house,
        plan_for_life: "torah_job",
        head_cover_type: "wig",
        proposal_limit_count: 3,
        proposal_limit_period: "month",
        institution_id: institutionId,
      });
    }
    // אושר לקבל הצעות, לא אושר להצגה מלאה: עדיין כרטיס מוגבל
    await mustUpdate(restrictedId, {
      third_party_proposals_approved_at: new Date().toISOString(),
    });
    // מספר ת.ז. שנאסף בעבר נשמר בטבלה הנפרדת (students.identity_number ריק תמיד)
    const identity = await admin.from("student_identity_numbers").insert({
      student_id: restrictedId,
      identity_number: HIDDEN.identityNumber,
    });
    if (identity.error) throw new Error(identity.error.message);
    const medical = await admin.from("medical_records").insert({
      student_id: restrictedId,
      status: "littleProblem",
      details: SEEDED.partnerAbout,
    });
    if (medical.error) throw new Error(medical.error.message);

    matchmaker = await clientAs(admin, TEST_USER_EMAIL);
    staff = await clientAs(admin, STAFF_EMAIL);
  });

  test.afterAll(async () => {
    await deleteCards(admin, cardIds);
    await admin.from("staff_institutions").delete().eq("user_id", staffId);
    await admin.from("staff_info").delete().eq("user_id", staffId);
    if (institutionId) {
      await admin.from("institutions").delete().eq("id", institutionId);
    }
  });

  test("שדכן ואיש צוות: קריאה ישירה של students אינה מחזירה את הכרטיס המוגבל", async () => {
    for (const [label, client] of [
      ["שדכן", matchmaker],
      ["איש צוות", staff],
    ] as const) {
      // Act
      const named = await client
        .from("students")
        .select(
          "about, family_info, parents_info, phone, street, house, identity_number, plan_for_life, head_cover_type",
        )
        .eq("id", restrictedId);
      const star = await client
        .from("students")
        .select("*")
        .eq("id", restrictedId);
      const basicOnly = await client
        .from("students")
        .select("id, first_name")
        .eq("id", restrictedId);
      const byHiddenValue = await client
        .from("students")
        .select("id")
        .eq("last_name", RESTRICTED_LAST)
        .ilike("about", `%${SEEDED.about}%`);
      const byPhone = await client
        .from("students")
        .select("id")
        .eq("last_name", RESTRICTED_LAST)
        .eq("phone", HIDDEN.phone);

      // Assert: בלי שגיאה ובלי שורה - גם לא העמודות הבסיסיות, וגם לא כסינון
      for (const result of [named, star, basicOnly, byHiddenValue, byPhone]) {
        expect(result.error, `${label}: ${result.error?.message}`).toBeNull();
        expect(result.data, label).toEqual([]);
      }
    }
  });

  test("הטבלאות הרגישות ריקות לשדכן ולאיש צוות; הלימודים (נתון בסיסי) נשארים לשדכן", async () => {
    for (const [label, client] of [
      ["שדכן", matchmaker],
      ["איש צוות", staff],
    ] as const) {
      for (const table of SENSITIVE_CHILD_TABLES) {
        // Act
        const { data, error } = await client
          .from(table)
          .select("*")
          .eq("student_id", restrictedId);

        // Assert
        expect(error, `${label} ${table}: ${error?.message}`).toBeNull();
        expect(data, `${label} ${table}`).toEqual([]);
      }
    }
    const education = await matchmaker
      .from("education_history")
      .select("name")
      .eq("student_id", restrictedId);
    expect(education.data).toEqual([{ name: SEEDED.institutionName }]);
  });

  test("כל עמודה של students מסווגת, וה-view מחזיר בדיוק את העמודות שסווגו אליו", async () => {
    // Arrange
    const tableColumns = Object.keys(await tableRow(restrictedId));
    const inView: string[] = [
      ...VIEW_AS_IS,
      ...VIEW_OWNER_AND_ADMIN_ONLY,
      ...VIEW_NULL_WHEN_RESTRICTED,
      ...VIEW_REDUCED_WHEN_RESTRICTED,
      ...VIEW_ONLY_COLUMNS,
    ];
    const never: readonly string[] = NEVER_IN_VIEW;

    // Act
    const viewColumns = Object.keys(await viewRow(matchmaker, restrictedId));
    const unclassified = tableColumns.filter(
      (column) => !inView.includes(column) && !never.includes(column),
    );

    // Assert
    expect(unclassified, "עמודה חדשה ב-students שלא סווגה").toEqual([]);
    expect(inView.filter((column) => never.includes(column))).toEqual([]);
    expect([...viewColumns].sort()).toEqual([...inView].sort());
    expect(viewColumns).not.toContain("identity_number");
  });

  test("ה-view בכרטיס מוגבל: נתונים בסיסיים כמות שהם, כל השאר ריק או מצומצם", async () => {
    const expected = await tableRow(restrictedId);
    for (const [label, client] of [
      ["שדכן", matchmaker],
      ["איש צוות", staff],
    ] as const) {
      // Act
      const row = await viewRow(client, restrictedId);

      // Assert
      for (const column of VIEW_AS_IS) {
        expect(row[column], `${label} ${column}`).toEqual(expected[column]);
      }
      for (const column of [
        ...VIEW_NULL_WHEN_RESTRICTED,
        ...VIEW_OWNER_AND_ADMIN_ONLY,
      ]) {
        expect(row[column], `${label} ${column}`).toBeNull();
      }
      expect(row.parents_info, label).toEqual({
        father: { self: { name: SEEDED.fatherName } },
        mother: { self: { name: "שרה-שם-אם" } },
      });
      const author = asRecord(row.author_info, "author_info");
      const { fillReason, ...authorWithoutReason } = asRecord(
        expected.author_info,
        "author_info בטבלה",
      );
      expect(fillReason).toBe(SEEDED.fillReason);
      expect(author, label).toEqual(authorWithoutReason);
      expectNoHiddenValues(row, label);
    }
  });

  test("סינון ומיון על ה-view אינם חושפים עמודות חבויות", async () => {
    // Act: עמודות שאינן ב-view כלל
    const byAbout = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .ilike("about", `%${SEEDED.about}%`);
    const byPhone = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("phone", HIDDEN.phone);
    const byIdentity = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .order("identity_number");
    // עמודות שקיימות ב-view אך ריקות או מצומצמות בכרטיס מוגבל
    const byPlan = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("id", restrictedId)
      .eq("plan_for_life", "torah_job");
    const byFatherJob = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("id", restrictedId)
      .ilike("parents_info->father->>job", `%${SEEDED.fatherJob}%`);
    const byFillReason = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("id", restrictedId)
      .ilike("author_info->>fillReason", `%${SEEDED.fillReason}%`);
    const byFatherName = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("id", restrictedId)
      .ilike("parents_info->father->self->>name", `%${SEEDED.fatherName}%`);

    // Assert
    for (const refused of [byAbout, byPhone, byIdentity]) {
      expect(refused.error).not.toBeNull();
      expect(refused.data).toBeNull();
    }
    for (const empty of [byPlan, byFatherJob, byFillReason]) {
      expect(empty.error).toBeNull();
      expect(empty.data).toEqual([]);
    }
    // שם האב הוא נתון בסיסי, ולכן הסינון עליו ממשיך לעבוד
    expect(byFatherName.data).toEqual([{ id: restrictedId }]);
  });

  test("הרשימה, המועדפים, הלוח והכרטיס הבסיסי: הכרטיס המוגבל חוזר, עם נתונים בסיסיים בלבד", async () => {
    // Act
    const list = await buildStudentsPageQuery(
      matchmaker,
      { last_name: RESTRICTED_LAST, cardFilledBy: "third_party" },
      { key: "father", direction: "asc" },
      1,
    );
    const dashboard = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select(STUDENT_TABLE_COLUMNS)
      .in("id", [restrictedId]);
    const desk = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select(DESK_STUDENT_SELECT)
      .in("id", [restrictedId]);
    const basicCard = await matchmaker
      .from(STUDENT_CARDS_VIEW)
      .select(BASIC_STUDENT_SELECT)
      .eq("id", restrictedId)
      .single();

    // Assert
    expect(list.error, list.error?.message).toBeNull();
    expect(list.count).toBe(1);
    for (const [label, result] of [
      ["רשימה", list],
      ["מועדפים", dashboard],
      ["לוח", desk],
    ] as const) {
      expect(result.error, `${label}: ${result.error?.message}`).toBeNull();
      const rows = result.data ?? [];
      expect(rows, label).toHaveLength(1);
      const row = asRecord(rows[0], label);
      expect(row.id, label).toBe(restrictedId);
      expect(row.card_for, label).toBe("other");
      expect(row.third_party_full_display_approved_at, label).toBeNull();
      expect(JSON.stringify(row.parents_info), label).toContain(
        SEEDED.fatherName,
      );
      expectNoHiddenValues(row, label);
    }
    // הלוח: לבדיקת ההתאמה אין מה להשוות בכרטיס מוגבל
    const deskRow = asRecord(desk.data?.[0], "לוח");
    expect(deskRow.plan_for_life).toBeNull();
    expect(deskRow.head_cover_type).toBeNull();
    expect(deskRow.partner_preferences).toBeNull();
    // הכרטיס הבסיסי: כולל לימודים, בלי שום ערך חבוי
    expect(basicCard.error, basicCard.error?.message).toBeNull();
    const card = asRecord(basicCard.data, "כרטיס בסיסי");
    expect(card.education_history).toHaveLength(1);
    expect(card.parents_father).toEqual({ name: SEEDED.fatherName });
    expectNoHiddenValues(card, "כרטיס בסיסי");
  });

  test("הצעה לכרטיס מוגבל: השדכן יוצר טיוטה, ורשימת ההצעות מציגה את הכרטיס דרך ה-view", async () => {
    // Act: בדיקת המגדר (טריגר) קוראת את students גם כשהשורה חסומה לשדכן
    const created = await matchmaker
      .from("shidduchim")
      .insert({
        groom_id: groomId,
        bride_id: restrictedId,
        shadchan_id: matchmakerId,
        status: "draft",
      })
      .select("id")
      .single();
    const viaView = await matchmaker
      .from("shidduchim")
      .select(
        `id, bride:${STUDENT_CARDS_VIEW}!shidduchim_bride_id_fkey(first_name, card_for, third_party_proposals_approved_at)`,
      )
      .eq("bride_id", restrictedId)
      .single();
    const viaTable = await matchmaker
      .from("shidduchim")
      .select("id, bride:students!shidduchim_bride_id_fkey(first_name, phone)")
      .eq("bride_id", restrictedId)
      .single();

    // Assert
    expect(created.error, created.error?.message).toBeNull();
    expect(viaView.error, viaView.error?.message).toBeNull();
    const bride = asRecord(asRecord(viaView.data, "הצעה").bride, "כלה");
    expect(bride.card_for).toBe("other");
    expect(bride.third_party_proposals_approved_at).not.toBeNull();
    expect(asRecord(viaTable.data, "הצעה").bride).toBeNull();
  });

  test("כרטיס ישן, כרטיס רגיל וכרטיס צד שלישי שאושר: בלי שינוי, בטבלה וב-view", async () => {
    for (const [label, studentId] of [
      ["ישן (card_for ריק)", legacyId],
      ["רגיל", regularId],
      ["צד שלישי שאושר", approvedId],
    ] as const) {
      // Act
      const direct = await matchmaker
        .from("students")
        .select(
          "about, phone, street, identity_number, plan_for_life, parents_info, references(name), partner_preferences(about_partner)",
        )
        .eq("id", studentId)
        .single();
      const row = await viewRow(matchmaker, studentId);
      const expected = await tableRow(studentId);

      // Assert: הקריאה הישירה מלאה כמו היום
      expect(direct.error, `${label}: ${direct.error?.message}`).toBeNull();
      const full = asRecord(direct.data, label);
      expect(full.about, label).toBe(SEEDED.about);
      expect(full.phone, label).toBe(HIDDEN.phone);
      expect(JSON.stringify(full), label).toContain(SEEDED.fatherJob);
      expect(JSON.stringify(full), label).toContain(SEEDED.referenceName);
      expect(JSON.stringify(full), label).toContain(SEEDED.partnerAbout);
      // וה-view מחזיר את העמודות שלו כמות שהן, בלי צמצום
      for (const column of [
        ...VIEW_AS_IS,
        ...VIEW_OWNER_AND_ADMIN_ONLY,
        ...VIEW_NULL_WHEN_RESTRICTED,
        ...VIEW_REDUCED_WHEN_RESTRICTED,
      ]) {
        expect(row[column], `${label} ${column}`).toEqual(expected[column]);
      }
    }
  });

  test("בעל הכרטיס ומנהל: קוראים הכול ישירות, וה-view אינו מצמצם להם", async () => {
    const expected = await tableRow(restrictedId);
    for (const email of [CARD_MANAGER_EMAIL, ADMIN_EMAIL]) {
      // Arrange
      const client = await clientAs(admin, email);

      // Act
      const direct = await client
        .from("students")
        .select(
          "about, phone, identity_number, author_info, parents_info, references(name), medical_records(details)",
        )
        .eq("id", restrictedId)
        .single();
      const row = await viewRow(client, restrictedId);
      const identity = await client
        .from("student_identity_numbers")
        .select("identity_number")
        .eq("student_id", restrictedId);

      // Assert
      expect(direct.error, `${email}: ${direct.error?.message}`).toBeNull();
      const json = JSON.stringify([direct.data, identity.data]);
      for (const value of [
        SEEDED.about,
        HIDDEN.phone,
        HIDDEN.identityNumber,
        SEEDED.fillReason,
        SEEDED.fatherJob,
        SEEDED.referenceName,
      ]) {
        expect(json, `${email} ${value}`).toContain(value);
      }
      expect(row.plan_for_life, email).toBe("torah_job");
      expect(row.parents_info, email).toEqual(expected.parents_info);
      expect(row.author_info, email).toEqual(expected.author_info);
    }
  });

  test("ה-view מציג לכל צופה את השורות שהוא רואה ב-students, ורק את הכרטיס המוגבל בנוסף", async () => {
    for (const email of [
      TEST_USER_EMAIL,
      STAFF_EMAIL,
      CARD_MANAGER_EMAIL,
      ADMIN_EMAIL,
      SECOND_PARENT_EMAIL,
    ]) {
      // Arrange
      const client = await clientAs(admin, email);

      // Act
      const fromTable = await visibleIds(client, "students");
      const fromView = await visibleIds(client, STUDENT_CARDS_VIEW);
      const onlyInView = fromView.filter((id) => !fromTable.includes(id));
      const onlyInTable = fromTable.filter((id) => !fromView.includes(id));

      // Assert: אותו כלל נראות; ההבדל היחיד הוא כרטיסים מוגבלים, ורק למי
      // שרואה אותם כשדכן או כאיש צוות של המוסד
      expect(onlyInTable, email).toEqual([]);
      const { data: extra } = await admin
        .from("students")
        .select("id, card_for, third_party_full_display_approved_at")
        .in("id", onlyInView.length > 0 ? onlyInView : [restrictedId]);
      for (const row of extra ?? []) {
        if (!onlyInView.includes(String(row.id))) continue;
        expect(row.card_for, email).toBe("other");
        expect(row.third_party_full_display_approved_at, email).toBeNull();
      }
      const seesRestrictedDirectly =
        email === CARD_MANAGER_EMAIL || email === ADMIN_EMAIL;
      const seesRestrictedAtAll = email !== SECOND_PARENT_EMAIL;
      expect(fromTable.includes(restrictedId), email).toBe(
        seesRestrictedDirectly,
      );
      expect(fromView.includes(restrictedId), email).toBe(seesRestrictedAtAll);
    }
  });

  test("גולש לא מחובר ו-service role אינם מקבלים דבר מה-view", async () => {
    // Act
    const service = await admin
      .from(STUDENT_CARDS_VIEW)
      .select("id")
      .eq("id", restrictedId);

    // Assert: ל-service role אין הרשאה על ה-view (הוא קורא את הטבלה עצמה)
    expect(service.data ?? []).toEqual([]);
    expect(service.error).not.toBeNull();
  });

  test("אחרי אישור הצגה מלאה: השדכן ואיש הצוות קוראים שוב את הכרטיס ישירות", async () => {
    // Arrange
    await mustUpdate(restrictedId, {
      third_party_full_display_approved_at: new Date().toISOString(),
    });

    // Act
    const direct = await matchmaker
      .from("students")
      .select(
        "about, phone, parents_info, references(name), partner_preferences(about_partner)",
      )
      .eq("id", restrictedId)
      .single();
    const staffDirect = await staff
      .from("students")
      .select("about, phone")
      .eq("id", restrictedId)
      .single();
    const row = await viewRow(matchmaker, restrictedId);
    const expected = await tableRow(restrictedId);

    // Assert
    expect(direct.error, direct.error?.message).toBeNull();
    const json = JSON.stringify(direct.data);
    for (const value of [
      SEEDED.about,
      HIDDEN.phone,
      SEEDED.fatherJob,
      SEEDED.referenceName,
      SEEDED.partnerAbout,
    ]) {
      expect(json, value).toContain(value);
    }
    expect(staffDirect.data).toEqual({
      about: SEEDED.about,
      phone: HIDDEN.phone,
    });
    expect(row.plan_for_life).toBe("torah_job");
    expect(row.parents_info).toEqual(expected.parents_info);
  });
});
