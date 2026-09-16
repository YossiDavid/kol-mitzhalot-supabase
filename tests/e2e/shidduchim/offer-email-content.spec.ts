import { test, expect } from "@playwright/test";

import { buildOfferEmailContent } from "../../../features/shidduchim/lib/send-offer-email";

/**
 * המייל על הצעת שידוך חדשה מודיע רק שהתקבלה הצעה, עם שם השדכן וקישור -
 * בלי שמות המיועדים ובלי הערות, כדי שמנהלי הכרטיסים ייכנסו ויגיבו.
 */
const SHADCHAN_NAME = "משה כהן";
const SHIDDUCH_ID = "00000000-0000-4000-8000-000000000001";

test.describe("תוכן מייל הצעת שידוך", () => {
  test("כולל הודעה, שם שדכן וקישור להצעה", () => {
    // Act
    const content = buildOfferEmailContent(SHADCHAN_NAME, SHIDDUCH_ID);

    // Assert
    expect(content.subject).toBe("התקבלה הצעת שידוך חדשה");
    // מייל יצא בפועל בלי כותרת (16.9.2026): SendGrid התעלם מהנושא שנשלח
    // בבקשה, כי לתבנית לא הייתה שורת נושא. מאז הנושא נשלח גם בנתוני התבנית
    // והתבנית משתמשת בו - ולכן שניהם חייבים להישאר מלאים.
    expect(content.subject.trim()).not.toBe("");
    expect(String(content.templateData.subject).trim()).not.toBe("");
    expect(content.text).toContain("התקבלה הצעת שידוך חדשה");
    expect(content.text).toContain(SHADCHAN_NAME);
    expect(content.text).toContain(`/app/shidduchim/${SHIDDUCH_ID}`);
    expect(content.templateData.shadchan_name).toBe(SHADCHAN_NAME);
    expect(String(content.templateData.offer_url)).toContain(
      `/app/shidduchim/${SHIDDUCH_ID}`,
    );
  });

  test("לא מעביר לתבנית שמות מיועדים או הערות", () => {
    // Act
    const content = buildOfferEmailContent(SHADCHAN_NAME, SHIDDUCH_ID);

    // Assert
    expect(Object.keys(content.templateData).sort()).toEqual([
      "offer_url",
      "shadchan_name",
      "subject",
    ]);
    expect(content.text).not.toContain("מיועד");
    expect(content.text).not.toContain("הערות");
  });
});
