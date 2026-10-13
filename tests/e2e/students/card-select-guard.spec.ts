import { expect, test } from "@playwright/test";

import {
  ANONYMOUS_BASIC_STUDENT_SELECT,
  ANONYMOUS_STUDENT_SELECT,
  BASIC_STUDENT_SELECT,
  FULL_STUDENT_SELECT,
  studentRowSchemas,
} from "../../../features/students/lib/student-card-data";
import {
  buildProposalStudentSelect,
  parseProposalRow,
  redactProposalStudent,
  type ProposalStudentRow,
} from "../../../features/students/lib/student-proposal-card";

/**
 * גארד נגד סחף: לכל וריאנט של כרטיס המיועד, העמודות שאסור לשלוף אינן
 * ב-select, וה-schema חותך אותן גם אם נשלפו בטעות. בדיקות טהורות על
 * מחרוזות ואובייקטים סינתטיים, בלי מסד ובלי דפדפן.
 */

const CONTACT_COLUMNS = [
  "phone",
  "street",
  "house",
  "cellphone_type",
  "cv_url",
];
/** פרטי ההתקשרות של המיועד/ת: אינם חלק מכרטיס בהצעה בשום פתיחה */
const PROPOSAL_NEVER_COLUMNS = ["phone", "street", "house"];
const IDENTITY_COLUMNS = ["identity_number", "institution_id", "user_id"];
const SENSITIVE_EMBEDS = [
  "medical_records",
  "partner_preferences",
  "previous_partners",
];
/**
 * העמודות שהכרטיס הבסיסי (צד שלישי שלא אושר) לא נושא. סוג הטלפון והקו"ח
 * כלולים בו בכוונה למחובר (ולכן אינם כאן), ונשללים מהאנונימי.
 */
const BASIC_RESTRICTED = [
  "phone",
  "street",
  "house",
  "about",
  "family_info",
  "plan_for_life",
  "head_cover_type",
  "identity_number",
  "references",
  ...SENSITIVE_EMBEDS,
];

/**
 * שמות הפריטים ברמה העליונה של select: עמודה, כינוי (alias:נתיב) או שם
 * ה-embed. כך "parents_father:parents_info->father->self" נספר כ-parents_father
 * ולא כ-parents_info, ו-"references(id, name)" כ-references.
 */
function selectedNames(select: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of select) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      items.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  items.push(current);
  return items.map((item) => item.trim().split(/[(:]/)[0].trim());
}

/** העמודות שבתוך ה-embed (בין הסוגריים), או null אם הוא לא נשלף */
function embedColumns(select: string, embed: string): string | null {
  const match = new RegExp(`(?<![a-z_])${embed}\\(([^)]*)\\)`).exec(select);
  return match ? match[1] : null;
}

function expectAbsent(select: string, forbidden: string[]) {
  const names = selectedNames(select);
  for (const name of forbidden) {
    expect(names, `${name} נשלף`).not.toContain(name);
  }
}

test.describe("ה-select של כל וריאנט", () => {
  test("גולש לא מחובר: בלי עמודות רגישות ובלי טבלאות רגישות", () => {
    expectAbsent(ANONYMOUS_STUDENT_SELECT, [
      ...CONTACT_COLUMNS,
      ...IDENTITY_COLUMNS,
      ...SENSITIVE_EMBEDS,
    ]);
    // הכרטיס הציבורי אינו מציג פרטי קשר של אף אדם: ממליצים בלי טלפון ואימייל
    expect(embedColumns(ANONYMOUS_STUDENT_SELECT, "references")).toBe(
      "id, reference_type, name",
    );
  });

  test("כרטיס בסיסי (מחובר ולא): בלי העמודות והטבלאות המוגבלות", () => {
    expectAbsent(BASIC_STUDENT_SELECT, BASIC_RESTRICTED);
    expectAbsent(ANONYMOUS_BASIC_STUDENT_SELECT, [
      ...BASIC_RESTRICTED,
      ...CONTACT_COLUMNS,
      ...IDENTITY_COLUMNS,
    ]);
  });

  test("הכרטיס הבסיסי שולף את שמות ההורים בלבד, לא את parents_info", () => {
    for (const select of [
      BASIC_STUDENT_SELECT,
      ANONYMOUS_BASIC_STUDENT_SELECT,
    ]) {
      expectAbsent(select, ["parents_info"]);
      expect(select).toContain("parents_info->father->self");
      expect(select).toContain("parents_info->mother->self");
    }
  });

  test("הצעה סגורה: בלי פרטי התקשרות, בלי קו״ח, בלי הצהרה רפואית, ממליצים בלי טלפון", () => {
    const select = buildProposalStudentSelect({
      shareCv: false,
      shareMedical: false,
    });

    expectAbsent(select, [
      ...PROPOSAL_NEVER_COLUMNS,
      "cv_url",
      ...IDENTITY_COLUMNS,
      "medical_records",
    ]);
    // סוג הטלפון הוא העדפה ולא פרט התקשרות: נשלף תמיד
    expect(selectedNames(select)).toContain("cellphone_type");
    const references = embedColumns(select, "references");
    expect(references).not.toBeNull();
    expect(references).not.toContain("phone");
    expect(references).not.toContain("email");
    expect(references).not.toBe("*");
  });

  test("הצעה: כל פתיחה מוסיפה רק את שלה, ואף אחת אינה מוסיפה פרטי התקשרות", () => {
    const cvOnly = buildProposalStudentSelect({
      shareCv: true,
      shareMedical: false,
    });
    const medicalOnly = buildProposalStudentSelect({
      shareCv: false,
      shareMedical: true,
    });
    const everything = buildProposalStudentSelect({
      shareCv: true,
      shareMedical: true,
    });

    expect(selectedNames(cvOnly)).toContain("cv_url");
    expectAbsent(cvOnly, ["medical_records"]);
    expect(selectedNames(medicalOnly)).toContain("medical_records");
    expectAbsent(medicalOnly, ["cv_url"]);
    for (const select of [cvOnly, medicalOnly, everything]) {
      expectAbsent(select, [...PROPOSAL_NEVER_COLUMNS, ...IDENTITY_COLUMNS]);
      expect(embedColumns(select, "references")).toBe(
        "id, reference_type, name",
      );
    }
  });

  test("הכרטיס המלא הוא select כוכבית, וה-schema הוא שחותך", () => {
    expect(selectedNames(FULL_STUDENT_SELECT)[0]).toBe("*");
    const parsed = studentRowSchemas.full.safeParse({
      ...fullRow(),
      identity_number: "123456789",
      institution_id: "inst-1",
    });
    expect(parsed.success).toBe(true);
    const keys = Object.keys(parsed.success ? parsed.data : {});
    expect(keys).not.toContain("identity_number");
    expect(keys).not.toContain("institution_id");
  });
});

function baseRow() {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    first_name: "פלוני",
    last_name: "אלמוני",
    nickname: null,
    gender: "male",
    personal_status: "single",
    birth_date: "2000-01-01",
    height: 175,
    country: "ישראל",
    city: "ירושלים",
    community: null,
    shtible: null,
    plan_for_life: null,
    head_cover_type: null,
    about: "אודות",
    in_shidduchim: true,
    parents_info: {
      father: { self: { name: "האב" }, phone: "050-0000000", email: "a@b.c" },
      mother: { self: { name: "האם" }, phone: "052-1111111" },
    },
    family_info: null,
    author_info: {
      name: "האב",
      phone: "050-0000000",
      email: "filler@example.test",
    },
    card_for: "self",
    third_party_full_display_approved_at: null,
    third_party_proposals_approved_at: null,
    education_history: [],
    employment_history: [],
    partner_preferences: null,
    previous_partners: [
      { full_name: "פלונית", divorce_details: { rabbiPhone: "03-1234567" } },
    ],
    references: [
      {
        id: "r1",
        reference_type: "rabbi",
        name: "הרב",
        phone: "03-7654321",
        email: "rabbi@example.com",
      },
    ],
  };
}

function fullRow() {
  return {
    ...baseRow(),
    user_id: "user-1",
    street: "הרחוב",
    house: "1",
    phone: "050-9999999",
    cellphone_type: "smart",
    image_url: null,
    cv_url: null,
    deleted_at: null,
    medical_records: null,
  };
}

test.describe("ה-schema חותך מה שלא הוצהר", () => {
  test("הצעה סגורה: טלפון, כתובת ופרטי קשר של ממליצים נחתכים", () => {
    // Arrange
    const row = {
      ...baseRow(),
      phone: "050-9999999",
      street: "הרחוב",
      cv_url: "cv.pdf",
    };

    // Act
    const parsed = parseProposalRow(row, {
      shareCv: false,
      shareMedical: false,
    });
    const withCv = parseProposalRow(row, {
      shareCv: true,
      shareMedical: false,
    });

    // Assert
    expect(parsed.success).toBe(true);
    const serialized = JSON.stringify(parsed.success ? parsed.data : {});
    for (const leaked of [
      "050-9999999",
      "הרחוב",
      "cv.pdf",
      "03-7654321",
      "rabbi@example.com",
    ]) {
      expect(serialized).not.toContain(leaked);
    }
    expect(serialized).toContain("הרב");
    // גם כשהקו״ח משותף: הוא עובר, פרטי ההתקשרות לא
    expect(withCv.success).toBe(true);
    const opened = JSON.stringify(withCv.success ? withCv.data : {});
    expect(opened).toContain("cv.pdf");
    for (const leaked of [
      "050-9999999",
      "הרחוב",
      "03-7654321",
      "rabbi@example.com",
    ]) {
      expect(opened).not.toContain(leaked);
    }
  });

  test("הצעה: הטיפוס אינו נושא עמודות התקשרות, בשום פתיחה", () => {
    const parsed = parseProposalRow(baseRow(), {
      shareCv: false,
      shareMedical: false,
    });
    if (!parsed.success) throw new Error("parse failed");
    const row: ProposalStudentRow = parsed.data;

    if (!("phone" in row)) {
      // @ts-expect-error - כרטיס בהצעה אינו נושא phone בטיפוס, בשום פתיחה
      expect(row.phone).toBeUndefined();
    }
    expect("phone" in row).toBe(false);
  });

  test("כרטיס בסיסי: שדות מוגבלים שנשלפו בטעות נחתכים", () => {
    const parsed = studentRowSchemas.basic.safeParse({
      ...baseRow(),
      user_id: "user-1",
      cellphone_type: null,
      cv_url: null,
      parents_father: { name: "האב" },
      parents_mother: null,
      phone: "050-9999999",
    });

    expect(parsed.success).toBe(true);
    const keys = Object.keys(parsed.success ? parsed.data : {});
    for (const restricted of [
      "phone",
      "about",
      "family_info",
      "references",
      "previous_partners",
    ]) {
      expect(keys).not.toContain(restricted);
    }
  });

  test("שורה שנכשלה באימות נדחית ולא עוברת הלאה", () => {
    const parsed = studentRowSchemas.anonymous.safeParse({
      ...baseRow(),
      gender: "other",
    });

    expect(parsed.success).toBe(false);
  });
});

test.describe("redactProposalStudent", () => {
  test("חותכת טלפון ואימייל מהורים ומפרטי הממלא, ואת טלפון הרב", () => {
    // Arrange
    const row = baseRow();

    // Act
    const redacted = redactProposalStudent(row);

    // Assert
    const parents = redacted.parents_info ?? {};
    for (const parent of Object.values(parents)) {
      expect(parent).not.toHaveProperty("phone");
      expect(parent).not.toHaveProperty("email");
    }
    expect(redacted.author_info).not.toHaveProperty("phone");
    expect(redacted.author_info).not.toHaveProperty("email");
    expect(JSON.stringify(redacted)).not.toContain("filler@example.test");
    expect(JSON.stringify(redacted)).not.toContain("03-1234567");
    expect(JSON.stringify(redacted)).toContain("האב");
  });

  test("הטיפוס שהיא מחזירה אינו נושא phone/email אצל הממלא", () => {
    const redacted = redactProposalStudent(baseRow());

    // הידור בלבד: phone/email הם never, ולכן אי אפשר לקרוא בהם ערך
    const phone: undefined = redacted.author_info?.phone;
    expect(phone).toBeUndefined();
    const email: undefined = redacted.author_info?.email;
    expect(email).toBeUndefined();
  });
});
