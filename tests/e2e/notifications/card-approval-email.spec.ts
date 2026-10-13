import { expect, test } from "@playwright/test";

import { buildCardApprovalEmail } from "../../../lib/email/templates/card-approval";

const INJECTION = `<script>alert("x")</script> & 'q'`;
const STUDENT_ID = "11111111-2222-4333-8444-555555555555";

test.describe("מייל אישור / דחיית כרטיס", () => {
  test("דחייה: הסיבה והשם מופיעים בטקסט, וב-HTML בריחה בלבד", () => {
    // Act
    const content = buildCardApprovalEmail({
      decision: "rejected",
      studentId: STUDENT_ID,
      candidateName: `דוד ${INJECTION}`,
      ownerFirstName: "משה",
      reason: INJECTION,
    });

    // Assert
    expect(content.subject).toContain("דוד");
    expect(content.text).toContain(`סיבה שצוינה: ${INJECTION}`);
    expect(content.text).toContain(`/app/students/${STUDENT_ID}`);
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).toContain('dir="rtl"');
    expect(content.html).toContain("לאישור מחדש");
    expect(content.dynamicData.reason).toBe(INJECTION);
  });

  test("אישור: בלי סיבה, עם קישור לכרטיס ופנייה כללית כשאין שם", () => {
    // Act
    const content = buildCardApprovalEmail({
      decision: "approved",
      studentId: STUDENT_ID,
      candidateName: "רחל לוי",
      ownerFirstName: null,
      reason: "סיבה שלא אמורה להופיע",
    });

    // Assert
    expect(content.subject).toBe("הכרטיס של רחל לוי אושר");
    expect(content.text.startsWith("שלום,")).toBe(true);
    expect(content.text).toContain("מוצג לשדכנים");
    expect(content.text).not.toContain("סיבה");
    expect(content.html).not.toContain("סיבה שלא אמורה להופיע");
    expect(content.html).toContain(`/app/students/${STUDENT_ID}`);
  });
});
