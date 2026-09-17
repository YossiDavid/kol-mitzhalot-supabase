import { expect, test } from "@playwright/test";

import {
  DEFAULT_NEXT_PATH,
  sanitizeNextPath,
  withNextParam,
} from "../../../features/auth/lib/next-path";
import { buildConfirmPath } from "../../../features/auth/lib/redirect-url";

/**
 * שמירת יעד ההפניה: מנהל כרטיס שמקבל מייל על הצעת שידוך לוחץ על קישור
 * ל-/app/shidduchim/<id>. כשהוא לא מחובר הוא נשלח להתחברות, ואחריה הוא
 * חייב לחזור להצעה ולא ל-/app.
 *
 * הבדיקה אינה יוצרת נתונים - היא רק מודדת לאן ההפניה מובילה.
 */

const PROPOSAL_PATH = "/app/shidduchim/00000000-0000-4000-8000-000000000001";

test.describe("סינון יעד ההפניה", () => {
  test("נתיב פנימי נשמר כמות שהוא", () => {
    expect(sanitizeNextPath(PROPOSAL_PATH)).toBe(PROPOSAL_PATH);
    expect(sanitizeNextPath("/app/proposals?from=mail")).toBe(
      "/app/proposals?from=mail",
    );
  });

  test("כתובת חיצונית נופלת לברירת המחדל", () => {
    // בלי זה מסך ההתחברות היה מגשר open redirect
    expect(sanitizeNextPath("https://evil.example")).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNextPath("//evil.example")).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNextPath("/\\evil.example")).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNextPath("javascript:alert(1)")).toBe(DEFAULT_NEXT_PATH);
  });

  test("ערך ריק או תווי בקרה נופלים לברירת המחדל", () => {
    expect(sanitizeNextPath(null)).toBe(DEFAULT_NEXT_PATH);
    expect(sanitizeNextPath("")).toBe(DEFAULT_NEXT_PATH);
    // ניסיון הזרקה לכותרת Location
    expect(sanitizeNextPath("/app\nSet-Cookie: a=b")).toBe(DEFAULT_NEXT_PATH);
  });

  test("withNextParam מוסיף next רק כשיש יעד אמיתי", () => {
    expect(withNextParam("/auth/login", PROPOSAL_PATH)).toBe(
      `/auth/login?next=${encodeURIComponent(PROPOSAL_PATH)}`,
    );
    expect(withNextParam("/auth/login", DEFAULT_NEXT_PATH)).toBe("/auth/login");
    expect(withNextParam("/auth/login", null)).toBe("/auth/login");
  });
});

test.describe("קישור ההתחברות במייל", () => {
  test("היעד נישא כסגמנטים של הנתיב ולא כ-query", () => {
    // תבנית ה-Magic Link מוסיפה "?token_hash=...&type=..." אל RedirectTo,
    // ולכן ערך עם query string היה נשבר שם.
    const path = buildConfirmPath(PROPOSAL_PATH);

    expect(path).toBe(`/auth/confirm${PROPOSAL_PATH}`);
    expect(path).not.toContain("?");
  });

  test("בלי יעד נשאר הנתיב הקלאסי", () => {
    expect(buildConfirmPath(null)).toBe("/auth/confirm");
    expect(buildConfirmPath(DEFAULT_NEXT_PATH)).toBe("/auth/confirm");
  });

  test("יעד חיצוני לא מייצר נתיב יציאה", () => {
    expect(buildConfirmPath("https://evil.example")).toBe("/auth/confirm");
  });
});

test.describe("הפניה להתחברות מעמוד פנימי", () => {
  test("קישור להצעת שידוך שומר את היעד ב-next", async ({ page }) => {
    // Act
    await page.goto(PROPOSAL_PATH);

    // Assert
    await expect(page).toHaveURL(
      `/auth/login?next=${encodeURIComponent(PROPOSAL_PATH)}`,
    );
    await expect(page.getByRole("heading", { name: "התחברות" })).toBeVisible();
  });

  test("כניסה ישירה להתחברות נשארת בלי next", async ({ page }) => {
    // Act
    await page.goto("/auth/login");

    // Assert
    await expect(page).toHaveURL("/auth/login");
  });
});
