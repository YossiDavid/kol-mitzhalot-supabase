import { test, expect } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * מנהל מערכת רואה בכרטיס את אימייל מנהל הכרטיס וקישור "פרטי המשתמש". הצד
 * השני (שדכן אינו רואה) יושב ב-tests/e2e/students/card-header.spec.ts.
 */
const admin = createServiceClient();
const lastName = `בעלים${Date.now()}`;
let studentId: string;
let ownerId: string;
let ownerEmail: string;

test.beforeAll(async () => {
  ownerId = await ensureCardManagerId(admin);
  const { data: owner, error: ownerError } =
    await admin.auth.admin.getUserById(ownerId);
  if (ownerError || !owner.user?.email) {
    throw new Error(`שליפת אימייל הבעלים נכשלה: ${ownerError?.message}`);
  }
  ownerEmail = owner.user.email;

  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: ownerId,
      first_name: "בדיקת",
      last_name: lastName,
      birth_date: "1998-01-01",
      gender: "female",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  studentId = data.id as string;
});

test.afterAll(async () => {
  if (studentId) await admin.from("students").delete().eq("id", studentId);
});

test.describe("אימייל מנהל הכרטיס — מנהל מערכת", () => {
  test("האימייל מוצג כקישור mailto בפרטים האישיים", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);

    // Assert
    const owner = page.locator('[data-slot="card-owner"]');
    await expect(owner.getByText("אימייל מנהל הכרטיס")).toBeVisible();
    await expect(owner.getByRole("link", { name: ownerEmail })).toHaveAttribute(
      "href",
      `mailto:${ownerEmail}`,
    );
  });

  test("קישור 'פרטי המשתמש' מוביל לעמוד המשתמש, גם מתפריט הפעולות", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);
    const userUrl = `/app/admin/users/${ownerId}`;

    // Assert - ליד האימייל
    await expect(
      page.locator('[data-slot="card-owner"]').getByRole("link", {
        name: "פרטי המשתמש",
      }),
    ).toHaveAttribute("href", userUrl);

    // Act + Assert - בתפריט הפעולות
    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await expect(
      page.getByRole("menuitem", { name: "פרטי המשתמש" }),
    ).toHaveAttribute("href", userUrl);
  });
});
