import { test, expect } from "@playwright/test";

import {
  areAllSelfCards,
  ownCardsHeading,
  ownCardsShadchanimSubtitle,
} from "../../../features/students/lib/own-cards-heading";

/**
 * כותרת אזור הכרטיסים בדשבורד לפי עבור מי מולאו הכרטיסים. פונקציות טהורות -
 * בלי דפדפן ובלי מסד. card_for ריק (כרטיס ישן) נחשב "לא עצמי".
 */
test.describe("ownCardsHeading", () => {
  test("כרטיס אחד לעצמי - 'הכרטיס שלי'", () => {
    expect(ownCardsHeading([{ card_for: "self" }])).toBe("הכרטיס שלי");
  });

  test("כמה כרטיסים, כולם לעצמי - 'הכרטיסים שלי'", () => {
    expect(ownCardsHeading([{ card_for: "self" }, { card_for: "self" }])).toBe(
      "הכרטיסים שלי",
    );
  });

  test("כרטיס לילד - 'המיועדים שלך'", () => {
    expect(ownCardsHeading([{ card_for: "child" }])).toBe("המיועדים שלך");
  });

  test("תערובת של עצמי וילד - 'המיועדים שלך'", () => {
    expect(ownCardsHeading([{ card_for: "self" }, { card_for: "child" }])).toBe(
      "המיועדים שלך",
    );
  });

  test("כרטיס ישן בלי card_for נחשב לא עצמי", () => {
    expect(ownCardsHeading([{ card_for: null }])).toBe("המיועדים שלך");
    expect(ownCardsHeading([{}])).toBe("המיועדים שלך");
  });

  test("בלי כרטיסים - 'המיועדים שלך'", () => {
    expect(ownCardsHeading([])).toBe("המיועדים שלך");
    expect(areAllSelfCards([])).toBe(false);
  });

  test("תיאור 'שדכנים שפעלו בשבילך' מתאים לכותרת", () => {
    expect(ownCardsShadchanimSubtitle([{ card_for: "self" }])).toContain(
      "בקו”ח שלך",
    );
    expect(ownCardsShadchanimSubtitle([{ card_for: "child" }])).toContain(
      "של המיועדים שלך",
    );
  });
});
