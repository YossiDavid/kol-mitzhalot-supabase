import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * רמת החשיפה של ההצהרה הרפואית נאכפת במסד
 * (20261027110000_medical_exposure_and_card_fields_rpcs.sql): שדכן אינו קורא את
 * medical_records ישירות דרך PostgREST, ומקבל מ-get_student_medical_record רק
 * את מה שרמת החשיפה מתירה. בעל הכרטיס ומנהל - הכול. כל הקריאות בלקוח עם JWT
 * אמיתי (RLS חל), בלי דפדפן.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
const LAST = `רפואי${T}`;

const SECRET = {
  details: `פירוט-חסוי-${T}`,
  document: `https://example.test/medical-${T}.pdf`,
  contactPhone: `0507${T.slice(-6)}`,
} as const;

type Exposure =
  | "only_for_kol_mitzhalot"
  | "basic_exposure"
  | "full_exposure"
  | "no_exposure";

const EXPOSURES: readonly Exposure[] = [
  "only_for_kol_mitzhalot",
  "basic_exposure",
  "full_exposure",
  "no_exposure",
];

type JsonRecord = Record<string, unknown>;

let svc: SupabaseClient;
let matchmaker: SupabaseClient;
let owner: SupabaseClient;
let adminUser: SupabaseClient;
let ownerId = "";
const cardByExposure = new Map<Exposure, string>();

async function seedCard(exposure: Exposure): Promise<string> {
  const id = await createCard(svc, {
    userId: ownerId,
    gender: "male",
    firstName: exposure,
    lastName: LAST,
  });
  const { error } = await svc.from("medical_records").insert({
    student_id: id,
    status: "hugeProblem",
    exposure_level: exposure,
    details: SECRET.details,
    documents: [SECRET.document],
    contact_info: {
      type: "other",
      contacts: [{ name: "איש-קשר", phone: SECRET.contactPhone }],
    },
    related_issue_preference: "no_issue",
  });
  if (error) throw new Error(`הזרעת הצהרה רפואית נכשלה: ${error.message}`);
  return id;
}

function cardId(exposure: Exposure): string {
  const id = cardByExposure.get(exposure);
  if (!id) throw new Error(`אין כרטיס לרמה ${exposure}`);
  return id;
}

async function medicalFor(
  client: SupabaseClient,
  exposure: Exposure,
): Promise<JsonRecord | null> {
  const { data, error } = await client.rpc("get_student_medical_record", {
    p_student_id: cardId(exposure),
  });
  expect(error, error?.message).toBeNull();
  return (data as JsonRecord | null) ?? null;
}

test.beforeAll(async () => {
  svc = createServiceClient();
  ownerId = await ensureCardManagerId(svc);
  [matchmaker, owner, adminUser] = await Promise.all([
    clientAs(svc, TEST_USER_EMAIL),
    clientAs(svc, CARD_MANAGER_EMAIL),
    clientAs(svc, ADMIN_EMAIL),
  ]);
  for (const exposure of EXPOSURES) {
    cardByExposure.set(exposure, await seedCard(exposure));
  }
});

test.afterAll(async () => {
  await deleteCards(svc, [...cardByExposure.values()]);
});

test.describe("הצהרה רפואית לפי רמת החשיפה", () => {
  test("שדכן אינו קורא את medical_records ישירות - לא בטבלה ולא ב-embed", async () => {
    // Arrange
    const ids = [...cardByExposure.values()];

    // Act
    const direct = await matchmaker
      .from("medical_records")
      .select("student_id, details, documents, contact_info")
      .in("student_id", ids);
    const embedded = await matchmaker
      .from("students")
      .select("id, medical_records(*)")
      .in("id", ids);

    // Assert
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);
    expect(embedded.error).toBeNull();
    expect(embedded.data).toHaveLength(ids.length);
    for (const row of embedded.data ?? []) {
      expect((row as JsonRecord).medical_records ?? null).toBeNull();
    }
    expect(JSON.stringify(embedded.data)).not.toContain(SECRET.details);
  });

  test("להנהלה בלבד: שדכן רואה רק שקיים מידע להנהלה", async () => {
    // Act
    const record = await medicalFor(matchmaker, "only_for_kol_mitzhalot");

    // Assert
    expect(record?.exposure_level).toBe("only_for_kol_mitzhalot");
    for (const key of [
      "status",
      "details",
      "documents",
      "contact_info",
      "related_issue_preference",
    ]) {
      expect(record?.[key] ?? null, key).toBeNull();
    }
    const json = JSON.stringify(record);
    for (const secret of Object.values(SECRET)) {
      expect(json).not.toContain(secret);
    }
  });

  test("חשיפה בסיסית: רמת הבעיה ופרטי קשר, בלי פירוט ומסמכים", async () => {
    // Act
    const record = await medicalFor(matchmaker, "basic_exposure");

    // Assert
    expect(record?.status).toBe("hugeProblem");
    expect(record?.related_issue_preference).toBe("no_issue");
    expect(record?.details ?? null).toBeNull();
    expect(record?.documents ?? null).toBeNull();
    expect(JSON.stringify(record)).toContain(SECRET.contactPhone);
    expect(JSON.stringify(record)).not.toContain(SECRET.details);
    expect(JSON.stringify(record)).not.toContain(SECRET.document);
  });

  test("חשיפה מלאה: הכול; הסתרת קיום הבעיה: כלום", async () => {
    // Act
    const full = await medicalFor(matchmaker, "full_exposure");
    const hidden = await medicalFor(matchmaker, "no_exposure");

    // Assert
    expect(full?.details).toBe(SECRET.details);
    expect(full?.documents).toEqual([SECRET.document]);
    expect(hidden).toBeNull();
  });

  test("בעל הכרטיס ומנהל רואים את ההצהרה המלאה בכל רמה", async () => {
    for (const exposure of EXPOSURES) {
      for (const [label, client] of [
        ["בעלים", owner],
        ["מנהל", adminUser],
      ] as const) {
        // Act
        const record = await medicalFor(client, exposure);

        // Assert
        expect(record?.details, `${label} ${exposure}`).toBe(SECRET.details);
        expect(record?.documents, `${label} ${exposure}`).toEqual([
          SECRET.document,
        ]);
      }
    }
    const direct = await owner
      .from("medical_records")
      .select("details")
      .eq("student_id", cardId("only_for_kol_mitzhalot"))
      .single();
    expect(direct.data?.details).toBe(SECRET.details);
  });

  test("כרטיס לשדכן: הודעה במקום הפרטים, והפרטים אינם ב-HTML", async ({
    page,
  }) => {
    // Act
    const response = await page.goto(
      `/app/students/${cardId("only_for_kol_mitzhalot")}`,
    );

    // Assert
    await expect(page.getByTestId("medical-management-only")).toHaveText(
      "קיים מידע רפואי שחשוף להנהלה בלבד",
    );
    const html = (await response?.text()) ?? "";
    expect(html).not.toContain(SECRET.details);
    expect(html).not.toContain(SECRET.document);
    expect(html).not.toContain(SECRET.contactPhone);
  });

  test("שמירה של שדכן אינה מוחקת הצהרה בחשיפה מוגבלת", async () => {
    // Arrange - מה שטופס העריכה של שדכן שולח: ההצהרה כפי שקיבל אותה (ריקה)
    const studentId = cardId("only_for_kol_mitzhalot");

    // Act
    const { error } = await matchmaker.rpc("update_full_student_profile", {
      p_student_id: studentId,
      payload: {
        first_name: "only_for_kol_mitzhalot",
        last_name: LAST,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        medical_records: null,
      },
    });

    // Assert
    expect(error, error?.message).toBeNull();
    const stored = await svc
      .from("medical_records")
      .select("details, exposure_level")
      .eq("student_id", studentId)
      .single();
    expect(stored.data).toEqual({
      details: SECRET.details,
      exposure_level: "only_for_kol_mitzhalot",
    });
  });
});
