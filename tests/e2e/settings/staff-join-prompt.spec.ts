/**
 * Callers: Playwright `chromium` project (הדפדפן מקבל סשן משלו, לא של משתמש
 * הבדיקה המשותף).
 * מי שנרשם כדי להיות איש צוות: באנר בדשבורד שמוביל להגדרות, "ממתין לאישור"
 * אחרי שהוגשה בקשה, והדגשה בסרגל הצד. פונקציית ההחלטה נבדקת ישירות.
 */
import { randomUUID } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  joinPrompt,
  staffJoinPrompt,
} from "../../../features/dashboard/lib/shadchan-join-prompt";
import { serviceClient } from "../helpers/dedications";

const LOAD = { timeout: 15_000 };
const DESKTOP = { width: 1440, height: 900 };

test.describe("staffJoinPrompt", () => {
  const base = {
    signupPurpose: "staff",
    isStaffOrAdmin: false,
    applicationStatus: null,
  } as const;

  test("נרשם כאיש צוות בלי בקשה - להשלים", () => {
    expect(staffJoinPrompt(base)).toBe("complete");
  });

  test("בקשה ממתינה - 'ממתינה לאישור'", () => {
    expect(staffJoinPrompt({ ...base, applicationStatus: "pending" })).toBe(
      "pending",
    );
  });

  test("איש צוות/מנהל, או בקשה שאושרה או נדחתה - כלום", () => {
    expect(staffJoinPrompt({ ...base, isStaffOrAdmin: true })).toBe("none");
    expect(staffJoinPrompt({ ...base, applicationStatus: "approved" })).toBe(
      "none",
    );
    expect(staffJoinPrompt({ ...base, applicationStatus: "rejected" })).toBe(
      "none",
    );
  });

  test("מטרת הרשמה אחרת (גם שדכן) - כלום", () => {
    for (const signupPurpose of ["shadchan", "self", "other", null]) {
      expect(staffJoinPrompt({ ...base, signupPurpose })).toBe("none");
    }
  });

  test("המסלולים אינם מתערבבים", () => {
    const input = {
      signupPurpose: "staff",
      hasTrackRoleOrAdmin: false,
      applicationStatus: null,
    } as const;
    expect(joinPrompt("shadchan", input)).toBe("none");
    expect(joinPrompt("staff", input)).toBe("complete");
  });
});

type SignupUser = { id: string; email: string };

async function createSignupUser(purpose: string): Promise<SignupUser> {
  const admin = serviceClient();
  const email = `join-${purpose}-${randomUUID()}@kol-mitzhalot.test`;
  const phone = `+9725${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      firstName: "הצטרפות",
      lastName: "בדיקה",
      phone,
      phone_verified: true,
      signup_purpose: purpose,
    },
  });
  if (error || !data.user)
    throw new Error(`יצירת משתמש נכשלה: ${error?.message}`);
  await admin
    .from("user_profiles")
    .upsert({ id: data.user.id, first_name: "הצטרפות", last_name: "בדיקה" });
  return { id: data.user.id, email };
}

/** דף עם סשן של המשתמש, בהקשר נפרד מהמשתמש המשותף */
async function openAsUser(browser: Browser, user: SignupUser): Promise<Page> {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error("יצירת קישור כניסה נכשלה");
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.setViewportSize(DESKTOP);
  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/app", LOAD);
  return page;
}

test.describe("באנר וסרגל הצד למי שנרשם כאיש צוות", () => {
  const created: SignupUser[] = [];

  test.afterAll(async () => {
    const admin = serviceClient();
    for (const user of created) {
      await admin.from("staff_info").delete().eq("user_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
    }
  });

  test("הבאנר מוביל להגדרות, והפריט בסרגל הצד מודגש", async ({ browser }) => {
    // Arrange
    const user = await createSignupUser("staff");
    created.push(user);
    const page = await openAsUser(browser, user);

    try {
      // Assert
      const banner = page.getByTestId("staff-join-banner");
      await expect(banner).toBeVisible(LOAD);
      await expect(banner).toHaveAttribute("data-prompt", "complete");
      await expect(
        banner.getByRole("link", { name: /להשלמת בקשת ההצטרפות כאיש צוות/ }),
      ).toHaveAttribute("href", "/app/settings/staff");
      await expect(page.getByTestId("shadchan-join-banner")).toHaveCount(0);
      await expect(page.getByTestId("sidebar-staff-join")).toHaveClass(
        /bg-primary\/10/,
      );
      await expect(page.getByTestId("sidebar-shadchan-join")).not.toHaveClass(
        /bg-primary\/10/,
      );
    } finally {
      await page.context().close();
    }
  });

  test("אחרי הגשת בקשה: 'הבקשה ממתינה לאישור' בלי כפתור", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSignupUser("staff");
    created.push(user);
    await serviceClient().from("staff_info").insert({
      user_id: user.id,
      application_status: "pending",
      submitted_at: new Date().toISOString(),
    });
    const page = await openAsUser(browser, user);

    try {
      // Assert
      const banner = page.getByTestId("staff-join-banner");
      await expect(banner).toHaveAttribute("data-prompt", "pending", LOAD);
      await expect(banner).toContainText("הבקשה ממתינה לאישור");
      await expect(banner.getByRole("link")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("מי שנרשם כשדכן לא רואה את באנר איש הצוות, ולהפך", async ({
    browser,
  }) => {
    // Arrange
    const user = await createSignupUser("shadchan");
    created.push(user);
    const page = await openAsUser(browser, user);

    try {
      // Assert
      await expect(page.getByTestId("shadchan-join-banner")).toBeVisible(LOAD);
      await expect(page.getByTestId("staff-join-banner")).toHaveCount(0);
      await expect(page.getByTestId("sidebar-staff-join")).not.toHaveClass(
        /bg-primary\/10/,
      );
    } finally {
      await page.context().close();
    }
  });
});
