import { test, expect } from "@playwright/test";

import { shadchanJoinPrompt } from "../../../features/dashboard/lib/shadchan-join-prompt";

/**
 * מי רואה בדשבורד את הבאנר "להשלמת בקשת ההצטרפות כשדכן": רק מי שנרשם כדי
 * להיות שדכן, עדיין אינו שדכן, ולא הגיש בקשה (או שהבקשה ממתינה).
 * פונקציה טהורה - בלי דפדפן ובלי מסד.
 */
test.describe("shadchanJoinPrompt", () => {
  const base = {
    signupPurpose: "shadchan",
    isShadchanOrAdmin: false,
    applicationStatus: null,
  } as const;

  test("נרשם כשדכן בלי בקשה - להשלים", () => {
    expect(shadchanJoinPrompt(base)).toBe("complete");
  });

  test("בקשה ממתינה - 'ממתינה לאישור'", () => {
    expect(shadchanJoinPrompt({ ...base, applicationStatus: "pending" })).toBe(
      "pending",
    );
  });

  test("שדכן מאושר (תפקיד) - כלום", () => {
    expect(shadchanJoinPrompt({ ...base, isShadchanOrAdmin: true })).toBe(
      "none",
    );
    expect(shadchanJoinPrompt({ ...base, applicationStatus: "approved" })).toBe(
      "none",
    );
  });

  test("מטרת הרשמה אחרת או חסרה - כלום", () => {
    expect(shadchanJoinPrompt({ ...base, signupPurpose: "self" })).toBe("none");
    expect(shadchanJoinPrompt({ ...base, signupPurpose: null })).toBe("none");
  });
});
