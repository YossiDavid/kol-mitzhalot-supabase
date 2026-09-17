import { expect, test } from "@playwright/test";

import {
  buildProposalStudentSelect,
  redactProposalStudent,
} from "../../../features/students/lib/student-proposal-card";

/**
 * הכרטיס כפי שמנהל כרטיס שקיבל הצעת שידוך רואה אותו: מלא, בלי פרטי
 * התקשרות ובלי הצהרה רפואית - אלא אם השדכן פתח אותם להצעה הזו.
 *
 * בדיקות טהורות על אובייקט סינתטי, בלי מסד ובלי דפדפן.
 */

const CLOSED = { shareContact: false, shareMedical: false };
const OPEN = { shareContact: true, shareMedical: true };

/** העמודות שאסור שיישלפו כשההתקשרות סגורה */
const CONTACT_COLUMNS = [
  "identity_number",
  "phone",
  "street",
  "house",
  "cellphone_type",
  "cv_url",
];

const PARENT_PHONE = "050-0000000";
const PARENT_EMAIL = "parent@example.com";
const MOTHER_PHONE = "052-1111111";
const RABBI_PHONE = "03-1234567";

function buildStudentRow() {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    first_name: "פלוני",
    parents_info: {
      father: {
        self: { name: "האב" },
        job: "מלמד",
        phone: PARENT_PHONE,
        email: PARENT_EMAIL,
      },
      mother: { self: { name: "האם" }, phone: MOTHER_PHONE },
    },
    author_info: { name: "האב", relation: "אב", phone: PARENT_PHONE },
    previous_partners: [
      {
        full_name: "פלונית",
        divorce_details: {
          reason: "סיבה",
          rabbiName: "הרב המלווה",
          rabbiPhone: RABBI_PHONE,
        },
      },
      { full_name: "בלי פירוט", divorce_details: null },
    ],
  };
}

test.describe("ה-select של כרטיס בהצעה", () => {
  test("ברירת מחדל: בלי עמודות התקשרות ובלי הצהרה רפואית", () => {
    // Act
    const select = buildProposalStudentSelect(CLOSED);

    // Assert
    for (const column of CONTACT_COLUMNS) {
      expect(select).not.toContain(column);
    }
    expect(select).not.toContain("medical_records");
    // ממליצים כן נשלפים - בלי טלפון ואימייל
    expect(select).toContain("references(id, reference_type, name)");
  });

  test("גוף הכרטיס נשלף במלואו", () => {
    // Act
    const select = buildProposalStudentSelect(CLOSED);

    // Assert
    for (const part of [
      "first_name",
      "nickname",
      "birth_date",
      "about",
      "parents_info",
      "family_info",
      "education_history(*)",
      "employment_history(*)",
      "partner_preferences(*)",
      "previous_partners(*)",
    ]) {
      expect(select).toContain(part);
    }
  });

  test("user_id ו-image_url לא נשלפים בשום מצב", () => {
    // הכרטיס לא מציג אותם, והתמונה עוברת דרך loadStudentPhotos בלבד
    for (const disclosure of [CLOSED, OPEN]) {
      const select = buildProposalStudentSelect(disclosure);
      expect(select).not.toContain("user_id");
      expect(select).not.toContain("image_url");
    }
  });

  test("כשהשדכן פותח - נוספות עמודות ההתקשרות והרפואה", () => {
    // Act
    const select = buildProposalStudentSelect(OPEN);

    // Assert
    for (const column of CONTACT_COLUMNS) {
      expect(select).toContain(column);
    }
    expect(select).toContain("medical_records(*)");
    expect(select).toContain("references(*)");
  });
});

test.describe("חיתוך פרטי קשר מעמודות JSON", () => {
  test("טלפון ואימייל של הורים נחתכים, השאר נשמר", () => {
    // Arrange
    const row = buildStudentRow();

    // Act
    const redacted = redactProposalStudent(row, CLOSED);

    // Assert
    const serialized = JSON.stringify(redacted);
    for (const value of [PARENT_PHONE, PARENT_EMAIL, MOTHER_PHONE]) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).toContain("מלמד");
    expect(serialized).toContain("האב");
  });

  test("טלפון הרב המלווה נחתך והשם נשאר", () => {
    // Act
    const redacted = redactProposalStudent(buildStudentRow(), CLOSED);

    // Assert
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain(RABBI_PHONE);
    expect(serialized).toContain("הרב המלווה");
    expect(serialized).toContain("סיבה");
  });

  test("שורה בלי divorce_details לא נשברת", () => {
    // Act
    const redacted = redactProposalStudent(buildStudentRow(), CLOSED) as {
      previous_partners: { divorce_details: unknown }[];
    };

    // Assert
    expect(redacted.previous_partners).toHaveLength(2);
    expect(redacted.previous_partners[1].divorce_details).toBeNull();
  });

  test("השורה המקורית אינה משתנה", () => {
    // Arrange
    const row = buildStudentRow();

    // Act
    redactProposalStudent(row, CLOSED);

    // Assert
    expect(row.author_info.phone).toBe(PARENT_PHONE);
    expect(row.parents_info.father.phone).toBe(PARENT_PHONE);
  });

  test("כשההתקשרות פתוחה השורה עוברת כמות שהיא", () => {
    // Arrange
    const row = buildStudentRow();

    // Act
    const result = redactProposalStudent(row, OPEN);

    // Assert
    expect(result).toBe(row);
  });
});
