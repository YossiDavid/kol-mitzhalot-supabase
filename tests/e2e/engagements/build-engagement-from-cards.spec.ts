import { expect, test } from "@playwright/test";

import {
  buildEngagementFromCards,
  fatherNameOf,
  latestInstitutionName,
  type EngagementCard,
} from "../../../features/engagements/lib/build-engagement-from-cards";

/** בדיקות יחידה לפונקציה הטהורה: כרטיסי חתן וכלה -> שדות מודעת אירוסין */

const CLOSED_AT = new Date("2026-10-06T10:00:00.000Z");
const SUBMITTER = {
  name: "דוד שדכן",
  phone: "+972500000001",
  email: "d@x.test",
};

function card(overrides: Partial<EngagementCard> = {}): EngagementCard {
  return {
    first_name: "משה",
    last_name: "כהן",
    city: "בני ברק",
    parents_info: {
      father: { self: { prefix: "הרב", name: "יעקב", suffix: "" } },
    },
    education_history: [],
    ...overrides,
  };
}

test.describe("buildEngagementFromCards", () => {
  test("ממפה שם, עיר, אב ופרטי שולח משני הכרטיסים", () => {
    // Arrange
    const groom = card({
      education_history: [
        { institution_type: "yeshiva_gdola", name: "פונוביז'" },
      ],
    });
    const bride = card({
      first_name: "שרה",
      last_name: "לוי",
      city: "ירושלים",
      parents_info: { father: { self: { name: "אברהם" } } },
      education_history: [{ institution_type: "seminar", name: "בית יעקב" }],
    });

    // Act
    const draft = buildEngagementFromCards({
      groom,
      bride,
      shadchanName: "רבקה שדכנית",
      submitter: SUBMITTER,
      closedAt: CLOSED_AT,
    });

    // Assert
    expect(draft).toEqual({
      groom_name: "משה כהן",
      groom_father: "יעקב",
      groom_city: "בני ברק",
      groom_yeshiva: "פונוביז'",
      bride_name: "שרה לוי",
      bride_father: "אברהם",
      bride_city: "ירושלים",
      bride_seminary: "בית יעקב",
      shadchan_name: "רבקה שדכנית",
      closed_at: "2026-10-06T10:00:00.000Z",
      submitter_name: "דוד שדכן",
      submitter_phone: "+972500000001",
      submitter_email: "d@x.test",
    });
  });

  test("שדות חסרים הופכים ל-null ולא למחרוזת ריקה", () => {
    // Arrange
    const sparse = card({
      city: "  ",
      parents_info: null,
      education_history: null,
    });

    // Act
    const draft = buildEngagementFromCards({
      groom: sparse,
      bride: sparse,
      shadchanName: null,
      submitter: { name: null, phone: "", email: null },
      closedAt: CLOSED_AT,
    });

    // Assert
    expect(draft.groom_city).toBeNull();
    expect(draft.groom_father).toBeNull();
    expect(draft.groom_yeshiva).toBeNull();
    expect(draft.bride_seminary).toBeNull();
    expect(draft.shadchan_name).toBeNull();
    expect(draft.submitter_name).toBeNull();
    expect(draft.submitter_phone).toBeNull();
  });
});

test.describe("latestInstitutionName", () => {
  test("מעדיף ישיבה גדולה על קטנה ולוקח את האחרונה ברשימה", () => {
    const education = [
      { institution_type: "yeshiva_ktana", name: "קטנה" },
      { institution_type: "yeshiva_gdola", name: "גדולה ראשונה" },
      { institution_type: "yeshiva_gdola", name: "גדולה אחרונה" },
      { institution_type: "kolel", name: "כולל" },
    ];

    expect(
      latestInstitutionName(education, ["yeshiva_gdola", "yeshiva_ktana"]),
    ).toBe("גדולה אחרונה");
  });

  test("נופל לישיבה קטנה כשאין גדולה, ומתעלם משורות בלי שם", () => {
    const education = [
      { institution_type: "yeshiva_ktana", name: "קטנה" },
      { institution_type: "yeshiva_gdola", name: "  " },
    ];

    expect(
      latestInstitutionName(education, ["yeshiva_gdola", "yeshiva_ktana"]),
    ).toBe("קטנה");
  });
});

test.describe("fatherNameOf", () => {
  test("קורא את father.self.name ומתעלם מתואר", () => {
    expect(
      fatherNameOf({ father: { self: { prefix: "הרב", name: " יעקב " } } }),
    ).toBe("יעקב");
  });

  test("מחזיר null למבנה לא צפוי", () => {
    expect(fatherNameOf("not json")).toBeNull();
    expect(fatherNameOf({ father: "x" })).toBeNull();
    expect(fatherNameOf(undefined)).toBeNull();
  });
});
