import { expect, test, type Page } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * הודעות מההנהלה למבקש הצטרפות: המבקש (בלי תפקיד, ללא storageState) רואה
 * אותן בעמוד הבקשה גם כשהבקשה נדחתה/ממתינה; route-ההודעה סגור למי שאינו מנהל.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const HEADING = "הודעות מההנהלה";
const SHADCHAN_TEXT = `הודעה לשדכן ${RUN_ID}`;
const STAFF_TEXT = `הודעה לאיש צוות ${RUN_ID}`;

const admin = createServiceClient();
let shadchanApplicant = { id: "", email: "" };
let staffApplicant = { id: "", email: "" };
let adminId = "";

async function createUser(label: string, index: number) {
  const email = `appmsg-view-${label}-${RUN_ID}@kol-mitzhalot.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone: `+9725${String(RUN_ID).slice(-7)}${index}`,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { firstName: "מבקש", lastName: label, phone_verified: true },
  });
  if (error || !data.user) throw new Error(`יצירת מבקש: ${error?.message}`);
  await admin
    .from("user_profiles")
    .upsert({ id: data.user.id, first_name: "מבקש", last_name: label });
  return { id: data.user.id, email };
}

test.beforeAll(async () => {
  shadchanApplicant = await createUser("sh", 1);
  staffApplicant = await createUser("st", 2);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  adminId =
    users.users.find(
      (u) =>
        u.email ===
        (process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test"),
    )?.id ?? "";
  expect(adminId).toBeTruthy();

  const now = new Date().toISOString();
  await admin.from("shadchanim_info").insert({
    user_id: shadchanApplicant.id,
    application_status: "rejected",
    submitted_at: now,
    rejected_at: now,
    rejected_reason: "בדיקה",
  });
  await admin.from("staff_info").insert({
    user_id: staffApplicant.id,
    application_status: "pending",
    submitted_at: now,
  });
  await admin.from("application_messages").insert([
    {
      request_kind: "shadchan",
      applicant_user_id: shadchanApplicant.id,
      admin_id: adminId,
      body: SHADCHAN_TEXT,
    },
    {
      request_kind: "staff",
      applicant_user_id: staffApplicant.id,
      admin_id: adminId,
      body: STAFF_TEXT,
    },
  ]);
});

test.afterAll(async () => {
  const ids = [shadchanApplicant.id, staffApplicant.id];
  await admin
    .from("application_messages")
    .delete()
    .in("applicant_user_id", ids);
  await admin.from("shadchanim_info").delete().in("user_id", ids);
  await admin.from("staff_info").delete().in("user_id", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
});

async function signIn(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  expect(error).toBeNull();
  await page.goto(
    `/auth/confirm?token_hash=${data?.properties?.hashed_token}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"), {
    timeout: LOAD_TIMEOUT,
  });
}

test.describe("הודעות מההנהלה בעמוד הבקשה", () => {
  test("מבקש שדכן שבקשתו נדחתה רואה את ההודעה שלו בלבד", async ({ page }) => {
    // Arrange
    await signIn(page, shadchanApplicant.email);

    // Act
    await page.goto("/app/settings/shadchan");

    // Assert
    const messages = page.getByTestId("application-messages");
    await expect(messages).toContainText(SHADCHAN_TEXT, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(
      messages.getByRole("heading", { name: HEADING }),
    ).toBeVisible();
    await expect(page.getByText(STAFF_TEXT)).toHaveCount(0);
  });

  test("מבקש איש צוות רואה את ההודעה בעמוד הבקשה", async ({ page }) => {
    // Arrange
    await signIn(page, staffApplicant.email);

    // Act
    await page.goto("/app/settings/staff");

    // Assert
    await expect(page.getByTestId("application-messages")).toContainText(
      STAFF_TEXT,
      { timeout: LOAD_TIMEOUT },
    );
    await expect(page.getByText(SHADCHAN_TEXT)).toHaveCount(0);
  });
});

test.describe("route שליחת ההודעה סגור למי שאינו מנהל", () => {
  const ROUTES = [
    "/api/v1/admin/shadchanim/message",
    "/api/v1/admin/staff/message",
  ];

  test("בלי התחברות: 401", async ({ request }) => {
    for (const route of ROUTES) {
      const response = await request.post(route, {
        data: { userId: shadchanApplicant.id, message: "שלום" },
      });
      expect(response.status()).toBe(401);
    }
  });

  test("משתמש מחובר שאינו מנהל: 403 ולא נשמרת הודעה", async ({ page }) => {
    // Arrange
    await signIn(page, shadchanApplicant.email);
    const before = await admin
      .from("application_messages")
      .select("id", { count: "exact", head: true })
      .eq("applicant_user_id", shadchanApplicant.id);

    // Act
    for (const route of ROUTES) {
      const response = await page.request.post(route, {
        data: { userId: shadchanApplicant.id, message: "הודעה לא חוקית" },
      });

      // Assert
      expect(response.status()).toBe(403);
    }
    const after = await admin
      .from("application_messages")
      .select("id", { count: "exact", head: true })
      .eq("applicant_user_id", shadchanApplicant.id);
    expect(after.count).toBe(before.count);
  });
});
