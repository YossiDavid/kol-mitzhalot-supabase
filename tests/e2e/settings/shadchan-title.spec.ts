import { expect, test } from "@playwright/test";

import {
  formatShadchanTitle,
  parseShadchanGender,
  shadchanRoleLabel,
} from "../../../features/shadchanim/lib/gender";
import { ageFromBirthDate } from "../../../features/shadchanim/lib/profile-form";

/**
 * כותרת השדכן לפי מגדר (הערות שדכן על כרטיס, עמוד השדכן) וחישוב הגיל
 * מתאריך הלידה בטופס ההצטרפות. פונקציות טהורות - בלי דפדפן ובלי מסד.
 */
test.describe("formatShadchanTitle", () => {
  test("שדכן, שדכנית, ומגדר לא ידוע", () => {
    expect(formatShadchanTitle("דוד פרידמן", "male")).toBe(
      "השדכן הרב דוד פרידמן",
    );
    expect(formatShadchanTitle("שרה וייס", "female")).toBe(
      "השדכנית גב' שרה וייס",
    );
    expect(formatShadchanTitle(" משה ", null)).toBe("השדכן/ית משה");
    expect(shadchanRoleLabel("female")).toBe("שדכנית");
  });

  test("ערך לא מוכר מהמסד נחשב לא ידוע", () => {
    expect(parseShadchanGender("other")).toBeNull();
    expect(parseShadchanGender(null)).toBeNull();
    expect(parseShadchanGender("male")).toBe("male");
  });
});

test.describe("ageFromBirthDate", () => {
  const today = new Date(2026, 9, 19);

  test("לפני ואחרי יום ההולדת השנה", () => {
    expect(ageFromBirthDate("1980-10-19", today)).toBe(46);
    expect(ageFromBirthDate("1980-10-20", today)).toBe(45);
  });

  test("תאריך לא תקין - null", () => {
    expect(ageFromBirthDate("1980-02-30", today)).toBeNull();
    expect(ageFromBirthDate("abc", today)).toBeNull();
  });
});
