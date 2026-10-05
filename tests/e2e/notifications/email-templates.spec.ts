import { expect, test } from "@playwright/test";

import { sendEmail } from "../../../lib/email/send-email";
import { escapeHtml } from "../../../lib/email/escape-html";
import { buildAdminNewSignupEmail } from "../../../lib/email/templates/admin-new-signup";
import { buildApplicationDecisionEmail } from "../../../lib/email/templates/application-decision";
import { buildClosedNoticeEmail } from "../../../lib/email/templates/shidduch-closed-notice";

const INJECTION = `<script>alert("x")</script> & 'q'`;

test.describe("תבניות מייל", () => {
  test("escapeHtml מנטרל תווים מסוכנים", () => {
    expect(escapeHtml(INJECTION)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;",
    );
  });

  test("דחיית בקשה: הסיבה מופיעה בטקסט ובתוך HTML בריחה בלבד", () => {
    // Act
    const content = buildApplicationDecisionEmail({
      kind: "shadchan",
      decision: "rejected",
      firstName: "משה",
      reason: INJECTION,
    });

    // Assert
    expect(content.subject.trim()).not.toBe("");
    expect(content.text).toContain(INJECTION);
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).toContain('dir="rtl"');
  });

  test("דחיית בקשה בלי סיבה: אין שורת סיבה", () => {
    const content = buildApplicationDecisionEmail({
      kind: "staff",
      decision: "rejected",
      firstName: null,
      reason: "  ",
    });

    expect(content.text).not.toContain("סיבה שצוינה");
    expect(content.html).not.toContain("סיבה שצוינה");
  });

  test("אישור בקשה: ברכה וקישור לאפליקציה", () => {
    const content = buildApplicationDecisionEmail({
      kind: "shadchan",
      decision: "approved",
      firstName: "שרה",
      reason: null,
    });

    expect(content.text).toContain("מזל טוב");
    expect(content.text).toContain("/app");
    expect(String(content.dynamicData.app_url)).toContain("/app");
  });

  test("מייל הרשמה חדשה: ערכי המשתמש עוברים בריחה וקישור לכרטיס", () => {
    const content = buildAdminNewSignupEmail({
      userId: "00000000-0000-4000-8000-000000000001",
      fullName: INJECTION,
      email: "a@b.co",
      phone: null,
    });

    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain(
      "/app/admin/users/00000000-0000-4000-8000-000000000001",
    );
    expect(content.text).toContain("לא צוין");
  });

  test("עדכון הצד השני: החלקים האוטומטיים לא חושפים מי דחה ומדוע", () => {
    // Act
    const content = buildClosedNoticeEmail(
      "משה כהן",
      "ההצעה אינה רלוונטית בשלב זה.",
    );
    const automatic = content.text.replace("ההצעה אינה רלוונטית בשלב זה.", "");

    // Assert
    for (const word of ["דחה", "דחתה", "דחו", "לא מעוניינ", "סירב"]) {
      expect(automatic).not.toContain(word);
    }
    expect(content.text).toContain("ההצעה אינה רלוונטית בשלב זה.");
    expect(content.text).toContain("/app/proposals");
  });

  test("עדכון הצד השני: הודעה חופשית עוברת בריחה ב-HTML", () => {
    const content = buildClosedNoticeEmail("שדכן", INJECTION);

    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
  });

  test("sendEmail בסביבת פיתוח: לא שולח ולא זורק", async () => {
    test.skip(
      process.env.SENDGRID_SEND_IN_DEV === "true" ||
        process.env.NODE_ENV === "production",
      "שליחה אמיתית מופעלת בסביבה - לא מריצים כדי לא לשלוח מייל",
    );

    const result = await sendEmail({
      to: "nobody@kol-mitzhalot.test",
      subject: "בדיקה",
      text: "בדיקה",
    });

    expect(result).toEqual({ ok: true, messageId: null, skipped: true });
  });

  test("sendEmail בלי נושא: תוצאת שגיאה ולא חריגה", async () => {
    const result = await sendEmail({
      to: "nobody@kol-mitzhalot.test",
      subject: "  ",
      text: "בדיקה",
    });

    expect(result.ok).toBe(false);
  });
});
