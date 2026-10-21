import { expect, test } from "@playwright/test";

import { COMPLETE_IDENTITY_COLUMNS } from "../helpers/shadchan-form";
import {
  createSessionUser,
  deleteSessionUsers,
  type SessionUser,
} from "../helpers/session-user";
import { serviceClient } from "../helpers/dedications";

/**
 * פרטי משתמש של המנהל: האם המשתמש הגיש בקשת הצטרפות כשדכן / כאיש צוות,
 * הסטטוס ("לא הגיש" כשאין), וקישור לכרטיס הבקשה בעמוד הבקשות (עוגן).
 */
const LOAD = { timeout: 60_000 };

const admin = serviceClient();
let applicant: SessionUser;

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async () => {
  applicant = await createSessionUser({ prefix: `applications${Date.now()}` });
});

test.afterAll(async () => {
  await admin.from("shadchanim_info").delete().eq("user_id", applicant.id);
  await admin.from("staff_info").delete().eq("user_id", applicant.id);
  await deleteSessionUsers([applicant]);
});

test.describe("פרטי משתמש - בקשות הצטרפות", () => {
  test("בלי בקשות: 'לא הגיש' בשתי השורות, בלי קישורים", async ({ page }) => {
    // Act
    await page.goto(`/app/admin/users/${applicant.id}`, LOAD);

    // Assert
    const shadchanRow = page.getByTestId("shadchan-application");
    const staffRow = page.getByTestId("staff-application");
    await expect(shadchanRow).toContainText("לא הגיש", LOAD);
    await expect(staffRow).toContainText("לא הגיש");
    await expect(shadchanRow.getByRole("link")).toHaveCount(0);
    await expect(staffRow.getByRole("link")).toHaveCount(0);
  });

  test("עם בקשות: סטטוס, הקפאה וקישור לכרטיס הבקשה בעמוד הבקשות", async ({
    page,
  }) => {
    // Arrange
    const now = new Date().toISOString();
    const shadchanInsert = await admin.from("shadchanim_info").insert({
      user_id: applicant.id,
      application_status: "pending",
      submitted_at: now,
      frozen_at: now,
      bio: "בקשה לבדיקת פרטי משתמש",
      contact_phone: "0501234567",
      community: "בעלזא",
      synagogue_rabbi: "הרב בדיקה",
      ...COMPLETE_IDENTITY_COLUMNS,
    });
    expect(shadchanInsert.error).toBeNull();
    const staffInsert = await admin.from("staff_info").insert({
      user_id: applicant.id,
      application_status: "rejected",
      submitted_at: now,
      rejected_at: now,
    });
    expect(staffInsert.error).toBeNull();

    // Act
    await page.goto(`/app/admin/users/${applicant.id}`, LOAD);

    // Assert - השורות
    const shadchanRow = page.getByTestId("shadchan-application");
    const staffRow = page.getByTestId("staff-application");
    await expect(shadchanRow).toContainText("ממתין לאישור", LOAD);
    await expect(shadchanRow).toContainText("מוקפא");
    await expect(staffRow).toContainText("נדחה");
    await expect(
      shadchanRow.getByRole("link", { name: "לצפייה בבקשה" }),
    ).toHaveAttribute(
      "href",
      `/app/admin/shadchanim/requests#request-${applicant.id}`,
    );
    await expect(
      shadchanRow.getByRole("link", { name: "עריכת פרופיל השדכן" }),
    ).toHaveAttribute("href", `/app/admin/shadchanim/${applicant.id}/edit`);
    await expect(
      staffRow.getByRole("link", { name: "לצפייה בבקשה" }),
    ).toHaveAttribute(
      "href",
      `/app/admin/staff/requests#request-${applicant.id}`,
    );

    // Act - מעבר לבקשת השדכן
    await shadchanRow.getByRole("link", { name: "לצפייה בבקשה" }).click();

    // Assert - העוגן מצביע על כרטיס הבקשה של המשתמש
    await expect(page).toHaveURL(
      new RegExp(`/app/admin/shadchanim/requests#request-${applicant.id}$`),
      LOAD,
    );
    const requestCard = page.locator(`#request-${applicant.id}`);
    await expect(requestCard).toContainText("בקשה לבדיקת פרטי משתמש", LOAD);
    await expect(requestCard).toBeInViewport();

    // Assert - גם בעמוד בקשות הצוות יש כרטיס עם העוגן
    await page.goto(`/app/admin/staff/requests#request-${applicant.id}`, LOAD);
    await expect(page.locator(`#request-${applicant.id}`)).toContainText(
      "נדחה",
      LOAD,
    );
  });
});
