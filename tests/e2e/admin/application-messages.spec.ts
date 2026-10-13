import { expect, test, type Page } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";
import { createUserSessionClient } from "../forums/forum-fixtures";

/**
 * הודעות מנהל למבקשי הצטרפות (שדכן / איש צוות): שליחה מתוך הבקשה בכל סטטוס
 * (התראה + שמירה + היסטוריה), דיאלוג דחייה עם סיבה חובה, ואישור עם הודעה
 * אופציונלית. המייל מדולג מחוץ ל-production (send-email.ts).
 */
const RUN_ID = Date.now();
const MESSAGE_TEXT = `הודעת בדיקה ${RUN_ID}`;
const SHADCHAN_LINK = "/app/settings/shadchan";
const STAFF_LINK = "/app/settings/staff";
const REJECT_REASON = `סיבת דחייה ${RUN_ID}`;
const APPROVE_MESSAGE = `מזל טוב ${RUN_ID}`;
const SAVED_TIMEOUT = 15_000;

const admin = createServiceClient();
const userIds: string[] = [];

type Seeded = { id: string; email: string };

async function seedApplicant(
  label: string,
  index: number,
  kind: "shadchan" | "staff",
  status: "pending" | "approved" | "rejected",
): Promise<Seeded> {
  const email = `appmsg-${label}-${RUN_ID}@kol-mitzhalot.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone: `+9725${String(RUN_ID).slice(-7)}${index}`,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { firstName: "מבקש", lastName: label },
  });
  if (error || !data.user) throw new Error(`יצירת מבקש: ${error?.message}`);
  const id = data.user.id;
  userIds.push(id);
  const table = kind === "shadchan" ? "shadchanim_info" : "staff_info";
  const { error: insertError } = await admin.from(table).insert({
    user_id: id,
    application_status: status,
    submitted_at: new Date().toISOString(),
    ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
    ...(status === "rejected"
      ? { rejected_at: new Date().toISOString(), rejected_reason: "ישן" }
      : {}),
  });
  if (insertError) throw new Error(`יצירת בקשה: ${insertError.message}`);
  return { id, email };
}

let pendingShadchan: Seeded;
let approvedShadchan: Seeded;
let rejectedShadchan: Seeded;
let pendingStaff: Seeded;
let rejectTarget: Seeded;
let approveWithMessage: Seeded;
let approveWithoutMessage: Seeded;

test.beforeAll(async () => {
  pendingShadchan = await seedApplicant("pend", 1, "shadchan", "pending");
  approvedShadchan = await seedApplicant("appr", 2, "shadchan", "approved");
  rejectedShadchan = await seedApplicant("rejd", 3, "shadchan", "rejected");
  pendingStaff = await seedApplicant("staff", 4, "staff", "pending");
  rejectTarget = await seedApplicant("rtgt", 5, "shadchan", "pending");
  approveWithMessage = await seedApplicant("awm", 6, "shadchan", "pending");
  approveWithoutMessage = await seedApplicant("anm", 7, "shadchan", "pending");
});

test.afterAll(async () => {
  await admin.from("notifications").delete().in("user_id", userIds);
  await admin
    .from("application_messages")
    .delete()
    .in("applicant_user_id", userIds);
  await admin.from("shadchanim_info").delete().in("user_id", userIds);
  await admin.from("staff_info").delete().in("user_id", userIds);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

function cardOf(page: Page, email: string) {
  return page.locator("[data-slot='card']").filter({ hasText: email });
}

async function messageRows(applicantId: string) {
  const { data } = await admin
    .from("application_messages")
    .select("request_kind, body, admin_id")
    .eq("applicant_user_id", applicantId);
  return data ?? [];
}

async function messageNotifications(applicantId: string) {
  const { data } = await admin
    .from("notifications")
    .select("type, link, body")
    .eq("user_id", applicantId)
    .eq("type", "application_message");
  return data ?? [];
}

async function sendViaDialog(page: Page, email: string, text: string) {
  const card = cardOf(page, email);
  await card.getByRole("button", { name: "שליחת הודעה למבקש/ת" }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "שלח הודעה" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("תוכן ההודעה").fill(text);
  await submit.click();
  await expect(dialog).toBeHidden({ timeout: SAVED_TIMEOUT });
}

test.describe("הודעת מנהל למבקש - שדכן", () => {
  test("בקשה ממתינה: התראה, שמירה והיסטוריה אצל המנהל", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/shadchanim/requests");

    // Act
    await sendViaDialog(page, pendingShadchan.email, MESSAGE_TEXT);

    // Assert
    await expect(
      cardOf(page, pendingShadchan.email).getByTestId(
        "application-message-item",
      ),
    ).toContainText(MESSAGE_TEXT, { timeout: SAVED_TIMEOUT });
    const rows = await messageRows(pendingShadchan.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      request_kind: "shadchan",
      body: MESSAGE_TEXT,
    });
    const notifications = await messageNotifications(pendingShadchan.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].link).toBe(SHADCHAN_LINK);
  });

  test("בקשה מאושרת ובקשה נדחית: אפשר לשלוח הודעה בכל סטטוס", async ({
    request,
  }) => {
    for (const applicant of [approvedShadchan, rejectedShadchan]) {
      // Act
      const response = await request.post("/api/v1/admin/shadchanim/message", {
        data: { userId: applicant.id, message: MESSAGE_TEXT },
      });

      // Assert
      expect(response.status()).toBe(200);
      expect(await messageRows(applicant.id)).toHaveLength(1);
      const notifications = await messageNotifications(applicant.id);
      expect(notifications.map((n) => n.link)).toEqual([SHADCHAN_LINK]);
    }
  });

  test("הודעה ריקה, ארוכה מדי ומשתמש ללא בקשה נדחים", async ({ request }) => {
    const bad = [
      { userId: pendingShadchan.id, message: "   " },
      { userId: pendingShadchan.id, message: "א".repeat(2001) },
      { userId: "not-a-uuid", message: "שלום" },
    ];
    for (const data of bad) {
      expect(
        (
          await request.post("/api/v1/admin/shadchanim/message", { data })
        ).status(),
      ).toBe(400);
    }
    const missing = await request.post("/api/v1/admin/shadchanim/message", {
      data: { userId: pendingStaff.id, message: "שלום" },
    });
    expect(missing.status()).toBe(404);
    expect(await messageRows(pendingStaff.id)).toHaveLength(0);
  });

  test("תקרה יומית: מעבר ל-20 הודעות מחזיר 429 בעברית", async ({ request }) => {
    // Arrange - ממלאים עד התקרה ישירות במסד
    const adminUser = await admin.auth.admin.listUsers({ perPage: 1000 });
    const adminId = adminUser.data.users.find(
      (u) =>
        u.email ===
        (process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test"),
    )?.id;
    expect(adminId).toBeTruthy();
    const filler = Array.from({ length: 20 }, (_, i) => ({
      request_kind: "shadchan",
      applicant_user_id: rejectTarget.id,
      admin_id: adminId,
      body: `מילוי ${i}`,
    }));
    await admin.from("application_messages").insert(filler);

    // Act
    const response = await request.post("/api/v1/admin/shadchanim/message", {
      data: { userId: rejectTarget.id, message: "עוד אחת" },
    });

    // Assert
    expect(response.status()).toBe(429);
    expect((await response.json()).error).toMatch(/[א-ת]/);
    await admin
      .from("application_messages")
      .delete()
      .eq("applicant_user_id", rejectTarget.id);
  });
});

test.describe("הודעת מנהל למבקש - איש צוות", () => {
  test("בקשה ממתינה: התראה עם קישור לעמוד איש הצוות והיסטוריה", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/admin/staff/requests");

    // Act
    await sendViaDialog(page, pendingStaff.email, MESSAGE_TEXT);

    // Assert
    await expect(
      cardOf(page, pendingStaff.email).getByTestId("application-message-item"),
    ).toContainText(MESSAGE_TEXT, { timeout: SAVED_TIMEOUT });
    expect((await messageRows(pendingStaff.id))[0]).toMatchObject({
      request_kind: "staff",
    });
    const notifications = await messageNotifications(pendingStaff.id);
    expect(notifications.map((n) => n.link)).toEqual([STAFF_LINK]);
  });
});

test.describe("דחייה ואישור בדיאלוג", () => {
  test("דחייה: הסיבה חובה ונשמרת ב-rejected_reason", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/shadchanim/requests");
    await cardOf(page, rejectTarget.email)
      .getByRole("button", { name: "דחה", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const submit = dialog.getByRole("button", { name: "דחה בקשה" });

    // Assert - בלי סיבה אי אפשר לשלוח (גם לא רווחים)
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("סיבת הדחייה").fill("   ");
    await expect(submit).toBeDisabled();

    // Act
    await dialog.getByLabel("סיבת הדחייה").fill(REJECT_REASON);
    await submit.click();

    // Assert
    await expect(dialog).toBeHidden({ timeout: SAVED_TIMEOUT });
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("shadchanim_info")
          .select("application_status, rejected_reason")
          .eq("user_id", rejectTarget.id)
          .single();
        return data;
      })
      .toEqual({
        application_status: "rejected",
        rejected_reason: REJECT_REASON,
      });
  });

  test("אישור עם הודעה: המבקש מקבל תפקיד, הודעה והתראה פעם אחת", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/admin/shadchanim/requests");
    await cardOf(page, approveWithMessage.email)
      .getByRole("button", { name: "אשר", exact: true })
      .click();
    const dialog = page.getByRole("dialog");

    // Act
    await dialog.getByLabel("הודעה למבקש/ת (אופציונלי)").fill(APPROVE_MESSAGE);
    await dialog.getByRole("button", { name: "אשר בקשה" }).click();

    // Assert
    await expect(dialog).toBeHidden({ timeout: SAVED_TIMEOUT });
    await expect
      .poll(async () => (await messageRows(approveWithMessage.id)).length)
      .toBe(1);
    expect((await messageRows(approveWithMessage.id))[0].body).toBe(
      APPROVE_MESSAGE,
    );
    expect(await messageNotifications(approveWithMessage.id)).toHaveLength(1);
    const { data } = await admin.auth.admin.getUserById(approveWithMessage.id);
    expect(JSON.stringify(data.user?.app_metadata)).toContain("shadchan");
  });

  test("אישור בלי הודעה: אין שורת הודעה ואין התראת הודעה", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/shadchanim/requests");
    await cardOf(page, approveWithoutMessage.email)
      .getByRole("button", { name: "אשר", exact: true })
      .click();

    // Act
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "אשר בקשה" })
      .click();

    // Assert
    await expect(page.getByRole("dialog")).toBeHidden({
      timeout: SAVED_TIMEOUT,
    });
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("shadchanim_info")
          .select("application_status")
          .eq("user_id", approveWithoutMessage.id)
          .single();
        return data?.application_status;
      })
      .toBe("approved");
    expect(await messageRows(approveWithoutMessage.id)).toHaveLength(0);
    expect(await messageNotifications(approveWithoutMessage.id)).toHaveLength(
      0,
    );
    const { data } = await admin.auth.admin.getUserById(
      approveWithoutMessage.id,
    );
    expect(JSON.stringify(data.user?.app_metadata)).toContain("shadchan");
  });
});

test.describe("פרטיות הודעות (RLS)", () => {
  test("מבקש קורא רק את ההודעות שלו, לא של מבקש אחר", async () => {
    // Arrange
    const session = await createUserSessionClient(
      admin,
      approvedShadchan.email,
    );

    // Act
    const { data, error } = await session
      .from("application_messages")
      .select("applicant_user_id, body");

    // Assert
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(
      data?.every((r) => r.applicant_user_id === approvedShadchan.id),
    ).toBe(true);
  });

  test("מבקש לא יכול לכתוב או למחוק הודעות", async () => {
    // Arrange
    const session = await createUserSessionClient(
      admin,
      rejectedShadchan.email,
    );

    // Act
    const insert = await session.from("application_messages").insert({
      request_kind: "shadchan",
      applicant_user_id: rejectedShadchan.id,
      admin_id: rejectedShadchan.id,
      body: "זיוף",
    });
    const remove = await session
      .from("application_messages")
      .delete()
      .eq("applicant_user_id", rejectedShadchan.id)
      .select("id");

    // Assert
    expect(insert.error).not.toBeNull();
    expect(remove.error !== null || (remove.data ?? []).length === 0).toBe(
      true,
    );
    expect(await messageRows(rejectedShadchan.id)).toHaveLength(1);
  });
});
