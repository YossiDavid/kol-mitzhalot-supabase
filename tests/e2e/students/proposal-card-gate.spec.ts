import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { withoutFillReason } from "../../../features/students/lib/author-info";
import {
  PROPOSAL_CONTACT_COLUMNS,
  PROPOSAL_STUDENT_COLUMNS,
  buildProposalStudentSelect,
  parseProposalRow,
  redactProposalStudent,
  type ProposalDisclosure,
} from "../../../features/students/lib/student-proposal-card";
import { deleteCards, seedFullCard } from "./third-party-card-fixtures";

/**
 * שער הכרטיס בהצעה, בשכבת המסד: מי שקיבל הצעת שידוך אינו קורא את שורת
 * students של הצד השני ולא את הטבלאות המקושרות, ומקבל את הכרטיס רק דרך
 * get_proposal_student_card - בדיוק מה שהווריאנט של ההצעה מרשה להציג, לפי מה
 * שהשדכן פתח. כל הקריאות כאן בלקוח עם JWT אמיתי של המשתמש (RLS חל), בלי דפדפן.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);

/** ערכים מובחנים של החתן: מחפשים אותם בתשובות כדי לוודא שלא דלפו */
const CONTACT = {
  phone: `050${T}1`,
  street: `רחוב-שער-${T}`,
  house: `9${T}`,
  cv: `https://example.test/cv-gate-${T}.pdf`,
  fatherPhone: `052${T}2`,
  fatherEmail: `father-gate-${T}@example.test`,
  authorPhone: `053${T}3`,
  refPhone: `054${T}4`,
  refEmail: `ref-gate-${T}@example.test`,
  rabbiPhone: `055${T}5`,
} as const;
const MEDICAL_DETAILS = `הצהרה-רפואית-שער-${T}`;
const IDENTITY_NUMBER = `7${T}7`;
const FILL_REASON = `סיבת-מילוי-שער-${T}`;
const ABOUT = `אודות-שער-${T}`;
const FATHER_JOB = `עיסוק-אב-שער-${T}`;

const CONTACT_KEYS: readonly string[] = PROPOSAL_CONTACT_COLUMNS;
const DISCLOSURES: readonly ProposalDisclosure[] = [
  { shareContact: false, shareMedical: false },
  { shareContact: true, shareMedical: false },
  { shareContact: false, shareMedical: true },
  { shareContact: true, shareMedical: true },
];

/**
 * כל עמודה של students מסווגת כאן: או שהפונקציה רשאית להחזיר אותה, או שהיא
 * לעולם לא נחשפת למי שקיבל הצעה. עמודה חדשה בטבלה שאינה באף רשימה מפילה את
 * הבדיקה - כך ההחלטה עליה מתקבלת במפורש, והיא אינה נחשפת בינתיים (הפונקציה
 * בונה את התשובה מרשימה מפורשת).
 */
const NEVER_IN_PROPOSAL = [
  "identity_number",
  "user_id",
  "institution_id",
  "image_url",
  "is_yeshiva",
  "photo_count",
  "created_at",
  "updated_at",
  "status_changed_at",
  "deleted_at",
  "deleted_by",
  "proposal_limit_count",
  "proposal_limit_period",
  "admin_paused_at",
  "admin_paused_by",
  "third_party_full_display_approved_by",
  "third_party_proposals_approved_by",
] as const;

const CHILD_TABLES = [
  "education_history",
  "employment_history",
  "partner_preferences",
  "previous_partners",
  "references",
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

/** סדר השורות ב-embed אינו מוגדר; ממיינים לפי id כדי להשוות תוכן */
function sortedById(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return [...value].sort((a, b) =>
    String(isRecord(a) ? a.id : "").localeCompare(
      String(isRecord(b) ? b.id : ""),
    ),
  );
}

function normalized(row: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, sortedById(value)]),
  );
}

let admin: SupabaseClient;
let viewer: SupabaseClient;
let shadchanId: string;
let managerId: string;
let parentBId: string;
let groomId = "";
let brideId = "";
let strangerGroomId = "";
let draftGroomId = "";
let otherSideGroomId = "";
let deletedProposalGroomId = "";
let restrictedGroomId = "";
let shidduchId = "";
const cardIds: string[] = [];

async function mustInsert(table: string, row: JsonRecord) {
  const { error } = await admin.from(table).insert(row);
  if (error) throw new Error(`הזנה ל-${table} נכשלה: ${error.message}`);
}

async function setDisclosure({
  shareContact,
  shareMedical,
}: ProposalDisclosure) {
  const { error } = await admin
    .from("shidduchim")
    .update({
      share_contact_details: shareContact,
      share_medical_info: shareMedical,
    })
    .eq("id", shidduchId);
  if (error) throw new Error(`עדכון פתיחה נכשל: ${error.message}`);
}

async function proposalCard(
  client: SupabaseClient,
  studentId: string,
): Promise<unknown> {
  const { data, error } = await client.rpc("get_proposal_student_card", {
    p_student_id: studentId,
  });
  expect(error, error?.message).toBeNull();
  return data;
}

/** מה שהווריאנט של ההצעה בקוד מרשה להציג: ה-select, החיתוך והסרת ההסבר */
async function expectedByTypeScript(
  disclosure: ProposalDisclosure,
): Promise<JsonRecord> {
  const { data, error } = await admin
    .from("students")
    .select(buildProposalStudentSelect(disclosure))
    .eq("id", groomId)
    .single();
  expect(error, error?.message).toBeNull();
  const redacted = redactProposalStudent(
    asRecord(data, "שורת ה-select של ההצעה"),
    disclosure,
  );
  return { ...redacted, author_info: withoutFillReason(redacted.author_info) };
}

test.describe("שער הכרטיס בהצעה (מסד)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    managerId = await ensureCardManagerId(admin);
    parentBId = await ensureSecondParentId(admin);

    const { data: groom, error } = await admin
      .from("students")
      .insert({
        user_id: managerId,
        card_for: "child",
        first_name: "חתן",
        last_name: `שער${T}`,
        birth_date: "1999-04-12",
        gender: "male",
        personal_status: "divorced",
        height: 178.5,
        identity_number: IDENTITY_NUMBER,
        phone: CONTACT.phone,
        country: "ישראל",
        city: "בית שמש",
        street: CONTACT.street,
        house: CONTACT.house,
        community: "גור",
        cellphone_type: "kosher",
        plan_for_life: "torah_job",
        cv_url: CONTACT.cv,
        about: ABOUT,
        in_shidduchim: true,
        parents_info: {
          father: {
            self: { prefix: "ר'", name: "יעקב", suffix: "" },
            phone: CONTACT.fatherPhone,
            email: CONTACT.fatherEmail,
            job: FATHER_JOB,
          },
          mother: { self: { prefix: "", name: "רחל", suffix: "" }, job: "" },
          status: "married",
        },
        family_info: { numberOfChildren: 6, about: "משפחה-שער" },
        author_info: {
          name: "אבא-ממלא",
          phone: CONTACT.authorPhone,
          relation: "אב",
          relationType: "father",
          knowsWell: true,
          fillReason: FILL_REASON,
        },
      })
      .select("id")
      .single();
    if (error || !groom) throw new Error(`יצירת החתן נכשלה: ${error?.message}`);
    groomId = groom.id as string;
    cardIds.push(groomId);

    await mustInsert("education_history", {
      student_id: groomId,
      institution_type: "yeshiva_gdola",
      name: `ישיבה-שער-${T}`,
    });
    await mustInsert("employment_history", {
      student_id: groomId,
      category: "working",
      role: "מורה",
    });
    await mustInsert("partner_preferences", {
      student_id: groomId,
      age_min: 19,
      age_max: 24,
      about_partner: "מחפש-שער",
    });
    await mustInsert("previous_partners", {
      student_id: groomId,
      separation_type: "divorce",
      full_name: "בת-זוג-קודמת-שער",
      divorce_details: { rabbiName: "הרב-שער", rabbiPhone: CONTACT.rabbiPhone },
    });
    await mustInsert("references", {
      student_id: groomId,
      reference_type: "friend",
      name: "ממליץ-שער",
      phone: CONTACT.refPhone,
      email: CONTACT.refEmail,
    });
    await mustInsert("medical_records", {
      student_id: groomId,
      status: "littleProblem",
      details: MEDICAL_DETAILS,
    });

    const card = (
      userId: string,
      gender: "male" | "female",
      firstName: string,
    ) => createCard(admin, { userId, gender, firstName, lastName: `שער${T}` });
    brideId = await card(parentBId, "female", "כלה");
    strangerGroomId = await card(managerId, "male", "זר");
    draftGroomId = await card(managerId, "male", "טיוטה");
    otherSideGroomId = await card(managerId, "male", "צד-אחר");
    deletedProposalGroomId = await card(managerId, "male", "נמחקה");
    cardIds.push(
      brideId,
      strangerGroomId,
      draftGroomId,
      otherSideGroomId,
      deletedProposalGroomId,
    );
    const { error: phoneError } = await admin
      .from("students")
      .update({ phone: CONTACT.phone })
      .in("id", [
        strangerGroomId,
        draftGroomId,
        otherSideGroomId,
        deletedProposalGroomId,
      ]);
    if (phoneError) throw new Error(phoneError.message);

    // כרטיס צד שלישי: אושר לקבל הצעות, לא אושר להצגה מלאה
    restrictedGroomId = await seedFullCard(admin, {
      ownerId: managerId,
      lastName: `שער-שלישי${T}`,
      gender: "male",
    });
    cardIds.push(restrictedGroomId);
    const { error: approveError } = await admin
      .from("students")
      .update({
        third_party_proposals_approved_at: new Date().toISOString(),
        phone: CONTACT.phone,
      })
      .eq("id", restrictedGroomId);
    if (approveError) throw new Error(approveError.message);

    shidduchId = await insertProposal(admin, { groomId, brideId, shadchanId });
    await insertProposal(admin, {
      groomId: draftGroomId,
      brideId,
      shadchanId,
      status: "draft",
    });
    await insertProposal(admin, {
      groomId: otherSideGroomId,
      brideId,
      shadchanId,
      scope: "groom_only",
    });
    const deletedId = await insertProposal(admin, {
      groomId: deletedProposalGroomId,
      brideId,
      shadchanId,
    });
    const { error: deleteError } = await admin
      .from("shidduchim")
      .delete()
      .eq("id", deletedId);
    if (deleteError) throw new Error(deleteError.message);
    const restrictedProposal = await insertProposal(admin, {
      groomId: restrictedGroomId,
      brideId,
      shadchanId,
    });
    const { error: openError } = await admin
      .from("shidduchim")
      .update({ share_contact_details: true, share_medical_info: true })
      .eq("id", restrictedProposal);
    if (openError) throw new Error(openError.message);

    viewer = await clientAs(admin, SECOND_PARENT_EMAIL);
  });

  test.afterAll(async () => {
    await deleteCards(admin, cardIds);
  });

  test("קריאה ישירה של students: מי שקיבל הצעה אינו מקבל את השורה, בשום פתיחה", async () => {
    for (const disclosure of DISCLOSURES) {
      // Arrange
      await setDisclosure(disclosure);

      // Act
      const named = await viewer
        .from("students")
        .select(
          "phone, street, house, identity_number, image_url, cv_url, parents_info",
        )
        .eq("id", groomId);
      const star = await viewer.from("students").select("*").eq("id", groomId);
      const byOwner = await viewer
        .from("students")
        .select("id")
        .eq("user_id", managerId);

      // Assert: בלי שגיאה ובלי שורה (ה-RLS מסנן את השורה כולה)
      expect(named.error).toBeNull();
      expect(named.data).toEqual([]);
      expect(star.error).toBeNull();
      expect(star.data).toEqual([]);
      expect(byOwner.data).toEqual([]);
    }
  });

  test("קריאה ישירה של הטבלאות המקושרות: ריקות, גם כשהכול נפתח", async () => {
    for (const disclosure of DISCLOSURES) {
      // Arrange
      await setDisclosure(disclosure);

      for (const table of CHILD_TABLES) {
        // Act
        const { data, error } = await viewer
          .from(table)
          .select("*")
          .eq("student_id", groomId);

        // Assert
        expect(error, `${table}: ${error?.message}`).toBeNull();
        expect(data, table).toEqual([]);
      }
    }
  });

  test("תמונות: אין קריאה ישירה, וההרשאה מצייתת ל-share_groom_photo", async () => {
    // Act
    const photosTable = await viewer
      .from("student_photos")
      .select("storage_path")
      .eq("student_id", groomId);
    const storageList = await viewer.storage.from("students").list(groomId);
    const canView = async () =>
      (
        await viewer.rpc("can_view_student_photo", {
          uid: parentBId,
          sid: groomId,
        })
      ).data;

    await admin
      .from("shidduchim")
      .update({ share_groom_photo: false })
      .eq("id", shidduchId);
    const whenWithheld = await canView();
    await admin
      .from("shidduchim")
      .update({ share_groom_photo: true })
      .eq("id", shidduchId);
    const whenShared = await canView();

    // Assert
    expect(photosTable.data ?? []).toEqual([]);
    expect(photosTable.error).not.toBeNull();
    expect(storageList.data ?? []).toEqual([]);
    expect(whenWithheld).toBe(false);
    expect(whenShared).toBe(true);
  });

  test("הפונקציה, בכל צירוף פתיחה: בדיוק המפתחות של הווריאנט, מפתח מול מפתח מול הקוד", async () => {
    for (const disclosure of DISCLOSURES) {
      const label = JSON.stringify(disclosure);
      // Arrange
      await setDisclosure(disclosure);

      // Act
      const actual = asRecord(await proposalCard(viewer, groomId), label);
      const expected = await expectedByTypeScript(disclosure);

      // Assert: אותו תוכן בדיוק כמו ה-select + החיתוך של הקוד
      expect(Object.keys(actual).sort(), label).toEqual(
        Object.keys(expected).sort(),
      );
      expect(normalized(actual), label).toEqual(normalized(expected));
      // ה-schema של הווריאנט מקבל את התשובה כמות שהיא
      const parsed = parseProposalRow(actual, disclosure);
      expect(parsed.success, label).toBe(true);

      // פרטי התקשרות: המפתחות והערכים רק כשנפתחו
      const json = JSON.stringify(actual);
      for (const key of CONTACT_KEYS) {
        expect(key in actual, `${label} ${key}`).toBe(disclosure.shareContact);
      }
      for (const value of Object.values(CONTACT)) {
        expect(json.includes(value), `${label} ${value}`).toBe(
          disclosure.shareContact,
        );
      }
      // הצהרה רפואית: רק כשנפתחה
      expect("medical_records" in actual, label).toBe(disclosure.shareMedical);
      expect(json.includes(MEDICAL_DETAILS), label).toBe(
        disclosure.shareMedical,
      );
      // לעולם לא: ת.ז., מזהי בעלים ומוסד, שדות ניהול וההסבר של הממלא
      for (const key of NEVER_IN_PROPOSAL) {
        expect(key in actual, `${label} ${key}`).toBe(false);
      }
      expect(json, label).not.toContain(IDENTITY_NUMBER);
      expect(json, label).not.toContain(managerId);
      expect(json, label).not.toContain(FILL_REASON);
      // ומה שההצעה כן מציגה תמיד
      expect(json, label).toContain(ABOUT);
      expect(json, label).toContain(FATHER_JOB);
    }
  });

  test("כל עמודה של students מסווגת: מוחזרת בהצעה או חסומה לתמיד", async () => {
    // Arrange
    await setDisclosure({ shareContact: true, shareMedical: true });
    const { data: fullRow, error } = await admin
      .from("students")
      .select("*")
      .eq("id", groomId)
      .single();
    expect(error).toBeNull();
    const tableColumns = Object.keys(asRecord(fullRow, "שורת students"));
    const allowed: readonly string[] = [
      ...PROPOSAL_STUDENT_COLUMNS,
      ...PROPOSAL_CONTACT_COLUMNS,
    ];
    const never: readonly string[] = NEVER_IN_PROPOSAL;

    // Act
    const actual = asRecord(await proposalCard(viewer, groomId), "הכול פתוח");
    const unclassified = tableColumns.filter(
      (column) => !allowed.includes(column) && !never.includes(column),
    );
    const returnedColumns = Object.keys(actual).filter((key) =>
      tableColumns.includes(key),
    );

    // Assert
    expect(unclassified, "עמודה חדשה ב-students שלא סווגה").toEqual([]);
    expect(allowed.filter((column) => never.includes(column))).toEqual([]);
    expect([...returnedColumns].sort()).toEqual([...allowed].sort());
  });

  test("בלי הצעה שחושפת את הכרטיס: לא הפונקציה ולא הטבלה מחזירות דבר", async () => {
    const hidden = {
      "אין הצעה": strangerGroomId,
      טיוטה: draftGroomId,
      "נשלחה רק לצד השני": otherSideGroomId,
      "ההצעה נמחקה": deletedProposalGroomId,
    };
    for (const [label, studentId] of Object.entries(hidden)) {
      // Act
      const card = await proposalCard(viewer, studentId);
      const direct = await viewer
        .from("students")
        .select("id, phone")
        .eq("id", studentId);

      // Assert
      expect(card, label).toBeNull();
      expect(direct.data, label).toEqual([]);
    }
  });

  test("כרטיס צד שלישי שלא אושר להצגה מלאה: נתונים בסיסיים בלבד, גם כשהכול נפתח", async () => {
    // Act
    const actual = asRecord(
      await proposalCard(viewer, restrictedGroomId),
      "כרטיס מוגבל",
    );
    const json = JSON.stringify(actual);

    // Assert
    expect(actual.about).toBeNull();
    expect(actual.family_info).toBeNull();
    expect(actual.plan_for_life).toBeNull();
    expect(actual.phone).toBeNull();
    expect(actual.street).toBeNull();
    expect(actual.partner_preferences).toBeNull();
    expect(actual.medical_records).toBeNull();
    expect(actual.references).toEqual([]);
    expect(actual.previous_partners).toEqual([]);
    expect(actual.parents_info).toEqual({
      father: { self: { name: "אברהם-שם-אב" } },
      mother: { self: { name: "שרה-שם-אם" } },
    });
    expect(json).not.toContain(CONTACT.phone);
    expect(json).not.toContain("0501119999");
    expect(actual.education_history).toHaveLength(1);
  });

  test("בעלים, שדכן ומנהל: הקריאה הישירה בלי שינוי, והפונקציה אינה בשבילם", async () => {
    for (const email of [CARD_MANAGER_EMAIL, TEST_USER_EMAIL, ADMIN_EMAIL]) {
      // Arrange
      const client = await clientAs(admin, email);

      // Act
      const { data, error } = await client
        .from("students")
        .select(
          "phone, street, about, references(phone), medical_records(details)",
        )
        .eq("id", groomId)
        .single();
      const card = await proposalCard(client, groomId);

      // Assert
      expect(error, `${email}: ${error?.message}`).toBeNull();
      const row = asRecord(data, email);
      expect(row.phone, email).toBe(CONTACT.phone);
      expect(row.street, email).toBe(CONTACT.street);
      expect(JSON.stringify(row), email).toContain(CONTACT.refPhone);
      expect(JSON.stringify(row), email).toContain(MEDICAL_DETAILS);
      expect(card, email).toBeNull();
    }
  });

  test("ההורה עצמו ממשיך לקרוא את הכרטיס שלו ישירות", async () => {
    // Act
    const { data, error } = await viewer
      .from("students")
      .select("id, user_id")
      .eq("id", brideId)
      .single();

    // Assert
    expect(error).toBeNull();
    expect(data).toEqual({ id: brideId, user_id: parentBId });
  });

  test("גולש לא מחובר: לא הטבלה ולא הפונקציה", async () => {
    // Arrange
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Act
    const direct = await anon
      .from("students")
      .select("phone")
      .eq("id", groomId);
    const card = await anon.rpc("get_proposal_student_card", {
      p_student_id: groomId,
    });

    // Assert
    expect(direct.data ?? []).toEqual([]);
    expect(card.data ?? null).toBeNull();
    expect(card.error).not.toBeNull();
  });
});
