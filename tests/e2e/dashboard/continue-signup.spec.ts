/**
 * Callers: Playwright `chromium` project (כל משתמש בהקשר נפרד).
 * "המשך הרשמה" בדשבורד אחרי אימות המייל: שדכן/איש צוות שלא הגישו בקשה,
 * והורה/מחפש לעצמו בלי כרטיס, רואים כרטיס גדול במרכז עם כפתור ליעד.
 * פונקציית ההחלטה נבדקת ישירות; התצוגה - עם משתמשים אמיתיים.
 */
import { expect, test } from "@playwright/test";

import { continueSignupTarget } from "../../../features/dashboard/lib/continue-signup";
import {
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";

const LOAD = { timeout: 30_000 };

test.describe("continueSignupTarget", () => {
  const base = {
    signupPurpose: null,
    shadchanPrompt: "none",
    staffPrompt: "none",
    ownCardsCount: 0,
    isShadchanView: false,
  } as const;

  test("בקשת הצטרפות שלא הוגשה - טופס ההצטרפות", () => {
    expect(
      continueSignupTarget({
        ...base,
        signupPurpose: "shadchan",
        shadchanPrompt: "complete",
      }),
    ).toBe("shadchan");
    expect(
      continueSignupTarget({
        ...base,
        signupPurpose: "staff",
        staffPrompt: "complete",
      }),
    ).toBe("staff");
  });

  test("בקשה ממתינה - אין 'המשך הרשמה'", () => {
    expect(
      continueSignupTarget({
        ...base,
        signupPurpose: "shadchan",
        shadchanPrompt: "pending",
      }),
    ).toBeNull();
  });

  test("הורה / מחפש לעצמו בלי כרטיס - הוספת כרטיס; עם כרטיס או בשגיאה - כלום", () => {
    expect(continueSignupTarget({ ...base, signupPurpose: "child" })).toBe(
      "card",
    );
    expect(continueSignupTarget({ ...base, signupPurpose: "self" })).toBe(
      "card",
    );
    expect(
      continueSignupTarget({
        ...base,
        signupPurpose: "child",
        ownCardsCount: 1,
      }),
    ).toBeNull();
    expect(
      continueSignupTarget({
        ...base,
        signupPurpose: "child",
        ownCardsCount: null,
      }),
    ).toBeNull();
  });

  test("שדכן/מנהל או איש צוות - כלום", () => {
    expect(
      continueSignupTarget({
        ...base,
        signupPurpose: "self",
        isShadchanView: true,
      }),
    ).toBeNull();
    expect(continueSignupTarget({ ...base, isStaff: true })).toBeNull();
  });

  test("מטרה אחרת או לא ידועה, בלי כרטיס ובלי בקשה - מסך בחירה", () => {
    expect(continueSignupTarget({ ...base, signupPurpose: "other" })).toBe(
      "choose",
    );
    expect(continueSignupTarget(base)).toBe("choose");
    expect(
      continueSignupTarget({ ...base, ownCardsCount: 1 }),
    ).toBeNull();
    expect(
      continueSignupTarget({ ...base, staffPrompt: "pending" }),
    ).toBeNull();
  });
});

test.describe("כרטיס 'המשך הרשמה' בדשבורד", () => {
  const created: SessionUser[] = [];

  test.afterAll(async () => {
    await deleteSessionUsers(created);
  });

  test("הורה בלי כרטיס: כפתור 'הוספת כרטיס', ו'אחר כך' מקטין לבאנר", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSessionUser({
      prefix: "continue-child",
      metadata: { signup_purpose: "child" },
    });
    created.push(user);
    const page = await openPageAs(browser, user);

    try {
      // Assert
      const cta = page.getByTestId("continue-signup-cta");
      await expect(cta).toHaveAttribute("data-target", "card", LOAD);
      await expect(
        cta.getByRole("link", { name: "הוספת כרטיס" }),
      ).toHaveAttribute("href", "/app/students/create");

      // Act
      await cta.getByRole("button", { name: "אחר כך" }).click();

      // Assert - נשאר באנר קטן עם אותו יעד
      await expect(cta).toHaveCount(0);
      const banner = page.getByTestId("continue-signup-banner");
      await expect(
        banner.getByRole("link", { name: "הוספת כרטיס" }),
      ).toHaveAttribute("href", "/app/students/create");

      // Act - כניסה חוזרת לדשבורד מציגה שוב את הכרטיס הגדול
      await page.reload();

      // Assert
      await expect(page.getByTestId("continue-signup-cta")).toBeVisible(LOAD);
    } finally {
      await page.context().close();
    }
  });

  test("מי שנרשם כשדכן: כפתור 'המשך הרשמה' לטופס ההצטרפות", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSessionUser({
      prefix: "continue-shadchan",
      metadata: { signup_purpose: "shadchan" },
    });
    created.push(user);
    const page = await openPageAs(browser, user);

    try {
      // Assert
      const cta = page.getByTestId("continue-signup-cta");
      await expect(cta).toHaveAttribute("data-target", "shadchan", LOAD);
      await expect(
        cta.getByRole("link", { name: "המשך הרשמה" }),
      ).toHaveAttribute("href", "/app/settings/shadchan");

      // Act
      await cta.getByRole("button", { name: "אחר כך" }).click();

      // Assert - "אחר כך" מחזיר את באנר ההצטרפות הקיים
      await expect(page.getByTestId("shadchan-join-banner")).toHaveAttribute(
        "data-prompt",
        "complete",
      );
    } finally {
      await page.context().close();
    }
  });
});
