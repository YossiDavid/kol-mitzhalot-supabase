/**
 * בדיקות יחידה (בלי דפדפן) למיילים של פניות מהאתר: מייל התשובה לפונה, גוף
 * הבקשה ל-SendGrid עם reply_to, ומייל ההתראה למנהלים על פנייה חדשה.
 */
import { expect, test } from "@playwright/test";

import {
  buildRequestBody,
  type SendEmailParams,
  type SendEmailResult,
} from "../../../lib/email/send-email";
import { buildSubmissionReplyEmail } from "../../../lib/email/templates/contact-submission-reply";
import {
  buildAdminNewContactSubmissionEmail,
  MESSAGE_EXCERPT_LENGTH,
} from "../../../lib/email/templates/admin-new-contact-submission";
import {
  loadAdminEmailsFromDb,
  notifyAdminsOfNewContactSubmission,
} from "../../../features/notifications/lib/notify-admins-new-contact-submission";

const INJECTION = `<script>alert("x")</script> & 'q'`;
const SUBMISSION_ID = "00000000-0000-4000-8000-0000000000aa";

const SUBMISSION = {
  id: SUBMISSION_ID,
  type: "contact" as const,
  name: INJECTION,
  email: "asker@example.com",
  phone: null,
  subject: "שאלה על האתר",
  message: INJECTION,
};

test.describe("מיילים של פניות מהאתר", () => {
  test("מייל תשובה: נושא, תשובה וציטוט ההודעה המקורית - בבריחה ב-HTML", () => {
    // Act
    const content = buildSubmissionReplyEmail({
      name: INJECTION,
      subject: "שאלה\nעל האתר",
      originalMessage: INJECTION,
      reply: `תשובה ${INJECTION}`,
    });

    // Assert
    expect(content.subject).toBe("תשובה לפנייתך: שאלה על האתר");
    expect(content.text).toContain(`תשובה ${INJECTION}`);
    expect(content.text).toContain("הפנייה המקורית");
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).toContain("הפנייה המקורית");
    expect(content.html).toContain('dir="rtl"');
  });

  test("מייל תשובה בלי נושא ובלי הודעה: נושא כללי ובלי ציטוט", () => {
    const content = buildSubmissionReplyEmail({
      name: "דוד",
      subject: null,
      originalMessage: null,
      reply: "תודה",
    });

    expect(content.subject).toBe("תשובה לפנייתך");
    expect(content.text).not.toContain("הפנייה המקורית");
  });

  test("גוף SendGrid: reply_to רק כשהוגדר, בלי לשנות שליחה קיימת", () => {
    const base: SendEmailParams = {
      to: "asker@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    };

    // Act
    const withReplyTo = buildRequestBody({
      ...base,
      replyTo: " info@kol-mitzhalot.test ",
    });
    const withoutReplyTo = buildRequestBody(base);
    const emptyReplyTo = buildRequestBody({ ...base, replyTo: "  " });
    const withTemplate = buildRequestBody({
      ...base,
      templateId: "d-123",
      replyTo: "info@kol-mitzhalot.test",
    });

    // Assert
    expect(withReplyTo.reply_to).toEqual({ email: "info@kol-mitzhalot.test" });
    expect(withoutReplyTo).not.toHaveProperty("reply_to");
    expect(emptyReplyTo).not.toHaveProperty("reply_to");
    expect(withTemplate.reply_to).toEqual({ email: "info@kol-mitzhalot.test" });
    expect(withReplyTo.personalizations).toEqual([
      { to: [{ email: "asker@example.com" }] },
    ]);
  });

  test("מייל למנהלים: פרטים בבריחה, תקציר ההודעה וקישור לחלון הפנייה", () => {
    // Act
    const content = buildAdminNewContactSubmissionEmail({
      ...SUBMISSION,
      message: "א".repeat(MESSAGE_EXCERPT_LENGTH + 50),
    });
    const escaped = buildAdminNewContactSubmissionEmail(SUBMISSION);

    // Assert
    expect(content.text).toContain(
      `/app/admin/content/submissions?id=${SUBMISSION_ID}`,
    );
    expect(content.html).toContain(
      `/app/admin/content/submissions?id=${SUBMISSION_ID}`,
    );
    expect(content.text).toContain("…");
    expect(content.text).not.toContain("א".repeat(MESSAGE_EXCERPT_LENGTH + 1));
    expect(escaped.html).not.toContain("<script>");
    expect(escaped.text).toContain("שאלה על האתר");
  });

  test("התראה למנהלים: מייל אחד לכל מנהל, וכשל שליחה לא זורק", async () => {
    // Arrange
    const sent: SendEmailParams[] = [];
    const send = async (params: SendEmailParams): Promise<SendEmailResult> => {
      sent.push(params);
      return params.to === "b@admin.test"
        ? { ok: false, error: "boom" }
        : { ok: true, messageId: null, skipped: true };
    };

    // Act
    const attempted = await notifyAdminsOfNewContactSubmission(
      { ...SUBMISSION, type: "shidduch_idea" },
      {
        loadAdminEmails: async () => ["a@admin.test", "b@admin.test"],
        send,
      },
    );

    // Assert
    expect(attempted).toBe(2);
    expect(sent.map((params) => params.to)).toEqual([
      "a@admin.test",
      "b@admin.test",
    ]);
    expect(sent[0].subject).toContain("רעיון לשידוך");
    expect(sent[0].text).toContain(`?id=${SUBMISSION_ID}`);
  });

  test("התראה למנהלים: כשל בשליפת המנהלים לא זורק ולא שולח", async () => {
    let calls = 0;
    const attempted = await notifyAdminsOfNewContactSubmission(SUBMISSION, {
      loadAdminEmails: async () => {
        throw new Error("db down");
      },
      send: async () => {
        calls += 1;
        return { ok: true, messageId: null, skipped: true };
      },
    });

    expect(attempted).toBe(0);
    expect(calls).toBe(0);
  });

  test("התראה למנהלים מול המסד המקומי: נשלפים מנהלים ונעשה ניסיון שליחה", async () => {
    // Arrange: התלות האמיתית לשליפת המנהלים (RPC get_admin_emails), שליחה מדומה
    const sent: string[] = [];

    // Act
    const attempted = await notifyAdminsOfNewContactSubmission(SUBMISSION, {
      loadAdminEmails: loadAdminEmailsFromDb,
      send: async (params) => {
        sent.push(params.to);
        return { ok: true, messageId: null, skipped: true };
      },
    });

    // Assert: בסביבת הבדיקות יש לפחות מנהל אחד (auth.setup.admin.ts)
    expect(attempted).toBeGreaterThan(0);
    expect(sent).toHaveLength(attempted);
  });
});
