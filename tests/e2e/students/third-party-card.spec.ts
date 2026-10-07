import { expect, test } from "@playwright/test";

import {
  buildAuthorInfo,
  describeAuthorRelation,
  readAuthorInfo,
  toAuthorFormValues,
  withoutFillReason,
} from "../../../features/students/lib/author-info";
import { parseCardFilledByFilter } from "../../../features/students/lib/card-filled-by-filter";
import {
  isDisplayRestricted,
  isFullDisplayPending,
  isProposalsPending,
  thirdPartyTagExplanation,
  thirdPartyTagLabel,
} from "../../../features/students/lib/third-party-card";
import { parentsInfoFromNames } from "../../../features/students/lib/student-card-data";

/**
 * כללי כרטיס צד שלישי - פונקציות טהורות, בלי דפדפן ובלי מסד: מי מוגבל
 * לנתונים בסיסיים, ניסוח התג לפי האישורים, וצורת author_info (חדשה וישנה).
 */
const APPROVED_AT = "2026-10-13T08:00:00Z";

const PENDING_OTHER = { card_for: "other" };
const FULLY_APPROVED = {
  card_for: "other",
  third_party_full_display_approved_at: APPROVED_AT,
  third_party_proposals_approved_at: APPROVED_AT,
};

test.describe("מי מוגבל לנתונים בסיסיים", () => {
  const stranger = { isOwner: false, isAdmin: false };

  test("שדכן מול צד שלישי שלא אושר - מוגבל", () => {
    expect(isDisplayRestricted(PENDING_OTHER, stranger)).toBe(true);
  });

  test("הממלא (מנהל הכרטיס) ומנהל מערכת אינם מוגבלים", () => {
    expect(
      isDisplayRestricted(PENDING_OTHER, { isOwner: true, isAdmin: false }),
    ).toBe(false);
    expect(
      isDisplayRestricted(PENDING_OTHER, { isOwner: false, isAdmin: true }),
    ).toBe(false);
  });

  test("אושרה הצגה מלאה - אין הגבלה", () => {
    expect(isDisplayRestricted(FULLY_APPROVED, stranger)).toBe(false);
  });

  test("אישור ההצעות אינו מאשר הצגה, וההפך - שני מתגים בלתי תלויים", () => {
    const proposalsOnly = {
      card_for: "other",
      third_party_proposals_approved_at: APPROVED_AT,
    };
    const displayOnly = {
      card_for: "other",
      third_party_full_display_approved_at: APPROVED_AT,
    };

    expect(isFullDisplayPending(proposalsOnly)).toBe(true);
    expect(isProposalsPending(proposalsOnly)).toBe(false);
    expect(isFullDisplayPending(displayOnly)).toBe(false);
    expect(isProposalsPending(displayOnly)).toBe(true);
  });

  test("עצמי, הורה וכרטיס ישן (null) - לא מוגבלים ולא ממתינים", () => {
    for (const card_for of ["self", "child", null, undefined]) {
      expect(isDisplayRestricted({ card_for }, stranger)).toBe(false);
      expect(isProposalsPending({ card_for })).toBe(false);
    }
  });
});

test.describe("תג וטולטיפ לפי מצב האישורים", () => {
  test("לא אושר: מידע בסיסי; אושר: ניסוח ניטרלי", () => {
    expect(thirdPartyTagLabel(PENDING_OTHER)).toBe(
      "מידע בסיסי · מולא ע״י צד שלישי",
    );
    expect(thirdPartyTagLabel(FULLY_APPROVED)).toBe("מולא ע״י צד שלישי");
  });

  test("הטולטיפ מסביר את המצב הנוכחי", () => {
    expect(thirdPartyTagExplanation(PENDING_OTHER)).toContain(
      "מידע בסיסי בלבד",
    );
    expect(thirdPartyTagExplanation(PENDING_OTHER)).toContain(
      "לא ניתן לשלוח אליו הצעות",
    );
    expect(thirdPartyTagExplanation(FULLY_APPROVED)).toContain(
      "אישרה קבלת הצעות",
    );
  });
});

test.describe("סינון מילוי הכרטיס", () => {
  test("מקבל רק direct / third_party, אחרת = הכל", () => {
    expect(parseCardFilledByFilter("direct")).toBe("direct");
    expect(parseCardFilledByFilter("third_party")).toBe("third_party");
    expect(parseCardFilledByFilter("")).toBeNull();
    expect(parseCardFilledByFilter("other")).toBeNull();
    expect(parseCardFilledByFilter(undefined)).toBeNull();
  });
});

test.describe("author_info", () => {
  test("צורה ישנה: טקסט קשר שתואם מתורגם, ואחר נשמר כ'אחר' בצד שלישי", () => {
    const legacyFather = readAuthorInfo(
      { name: "יוסי", phone: "0501234567", relation: "אב" },
      "child",
    );
    const legacyOther = readAuthorInfo(
      { name: "דני", phone: "0501234567", relation: "חבר של המשפחה" },
      "other",
    );
    const legacyUnmatchedParent = readAuthorInfo(
      { name: "סבתא", phone: "0501234567", relation: "סבתא" },
      "child",
    );

    expect(legacyFather.relationType).toBe("father");
    expect(legacyOther.relationType).toBe("other");
    expect(describeAuthorRelation(legacyOther)).toBe("אחר: חבר של המשפחה");
    // הורה שנכתב בו קשר שאינו אב/אם: ללא בחירה, והטקסט הישן נשאר לתצוגה
    expect(legacyUnmatchedParent.relationType).toBeNull();
    expect(describeAuthorRelation(legacyUnmatchedParent)).toBe("סבתא");
  });

  test("מילוי עצמי לא שומר פרטי ממלא", () => {
    const stored = buildAuthorInfo("self", {
      name: "נשאר",
      phone: "0501234567",
      relationType: "father",
    });

    expect(stored).toEqual({
      name: "",
      phone: "",
      relation: "",
      relationType: null,
      knowsWell: null,
      fillReason: "",
    });
  });

  test("הורה: קשר מובנה נשמר גם כתווית, בלי 'מכיר היטב' והסבר", () => {
    const stored = buildAuthorInfo("child", {
      name: "אבא",
      phone: "0501234567",
      relationType: "mother",
      knowsWell: "true",
      fillReason: "לא נשמר",
    });

    expect(stored).toMatchObject({
      relation: "אם",
      relationType: "mother",
      knowsWell: null,
      fillReason: "",
    });
  });

  test("צד שלישי: כל הפרטים נשמרים ומתחזרים לטופס", () => {
    const stored = buildAuthorInfo("other", {
      name: "שדכנית",
      phone: "0501234567",
      relationType: "other",
      relation: " מכרה של המשפחה ",
      knowsWell: "false",
      fillReason: " אין גישה למחשב ",
    });

    expect(stored).toEqual({
      name: "שדכנית",
      phone: "0501234567",
      relation: "מכרה של המשפחה",
      relationType: "other",
      knowsWell: false,
      fillReason: "אין גישה למחשב",
    });
    expect(toAuthorFormValues(stored)).toEqual({
      name: "שדכנית",
      phone: "0501234567",
      relation: "מכרה של המשפחה",
      relationType: "other",
      knowsWell: "false",
      fillReason: "אין גישה למחשב",
    });
  });

  test("ההסבר נחתך לצופה שאינו מנהל או הממלא", () => {
    const stripped = withoutFillReason({ name: "x", fillReason: "סוד" });

    expect(stripped).toEqual({ name: "x" });
  });
});

test.describe("שמות ההורים בכרטיס בסיסי", () => {
  test("מרכיב parents_info משני נתיבי השמות בלבד", () => {
    const row = parentsInfoFromNames({
      id: "1",
      parents_father: { name: "אברהם" },
      parents_mother: { name: "שרה" },
    });

    expect(row.parents_info).toEqual({
      father: { self: { name: "אברהם" } },
      mother: { self: { name: "שרה" } },
    });
    expect("parents_father" in row).toBe(false);
  });
});
