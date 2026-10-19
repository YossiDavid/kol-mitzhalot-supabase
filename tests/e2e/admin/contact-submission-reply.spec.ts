/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * מענה לפנייה מהאתר מתוך חלון הפנייה: המנהל כותב תשובה, היא נשמרת בהיסטוריה
 * (בפיתוח המייל לא נשלח בפועל - email_sent=false), והפנייה עוברת ל"נענה".
 * משתמש שאינו מנהל נחסם גם ב-route (403) וגם ב-RLS של טבלת התשובות.
 */
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { anonClient, serviceClient } from "../helpers/dedications";
import {
  apiClientFor,
  createSessionUser,
  deleteSessionUsers,
  openPageAs,
  type SessionUser,
} from "../helpers/session-user";

const PAGE_PATH = "/app/admin/content/submissions";
const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 15_000 };

async function seedSubmission(): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `reply-e2e-${id.slice(0, 8)}@kol-mitzhalot.test`;
  const { error } = await serviceClient().from("contact_submissions").insert({
    id,
    type: "contact",
    name: "פונה בדיקה",
    email,
    subject: `שאלה ${id.slice(0, 8)}`,
    message: "שלום, יש לי שאלה על האתר.",
    status: "new",
  });
  if (error) throw new Error(`זריעת פנייה נכשלה: ${error.message}`);
  return { id, email };
}

test.describe("מענה לפנייה מהאתר", () => {
  const seeded: string[] = [];
  let plainUser: SessionUser | null = null;

  test.afterAll(async () => {
    if (seeded.length) {
      await serviceClient()
        .from("contact_submissions")
        .delete()
        .in("id", seeded);
    }
    if (plainUser) await deleteSessionUsers([plainUser]);
  });

  test("מנהל עונה מתוך החלון: נשמר, הסטטוס 'נענה' וההיסטוריה מוצגת", async ({
    page,
  }) => {
    // Arrange: קישור ישיר ?id= כמו במייל למנהלים
    const { id, email } = await seedSubmission();
    seeded.push(id);
    const replyText = `תודה על פנייתך <b>${id.slice(0, 6)}</b>`;
    await page.setViewportSize(DESKTOP);
    await page.goto(`${PAGE_PATH}?id=${id}`);
    const detail = page.getByTestId("submission-detail");
    await expect(detail).toContainText(email, LOAD);

    // Act
    await detail.getByLabel(/תשובה לפונה/).fill(replyText);
    await detail.getByRole("button", { name: "שליחת תשובה" }).click();

    // Assert: בפיתוח - נשמר ולא נשלח, והמנהל מקבל על כך הודעה מפורשת
    await expect(page.getByText("בסביבת הפיתוח המייל לא נשלח")).toBeVisible(
      LOAD,
    );
    const item = detail.getByTestId("submission-reply-item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(replyText);
    await expect(item).toContainText("לא נשלח במייל");
    await expect(item).toContainText("Admin Test");

    const service = serviceClient();
    const { data: submission } = await service
      .from("contact_submissions")
      .select("status")
      .eq("id", id)
      .single();
    expect(submission?.status).toBe("replied");
    const { data: replies } = await service
      .from("contact_submission_replies")
      .select("body, sent_to, email_sent, author_id")
      .eq("submission_id", id);
    expect(replies).toHaveLength(1);
    expect(replies?.[0]).toMatchObject({
      body: replyText,
      sent_to: email,
      email_sent: false,
    });
    expect(replies?.[0].author_id).toBeTruthy();

    // Assert: מופיעה בלשונית "נענו", וההיסטוריה נטענת מחדש אחרי רענון
    await page.getByRole("button", { name: "נענו" }).click();
    await expect(page.getByRole("button", { name: /פונה בדיקה/ }).first())
      .toBeVisible(LOAD);
    await page.reload();
    await expect(
      page.getByTestId("submission-detail").getByTestId("submission-reply-item"),
    ).toContainText(replyText, LOAD);
  });

  test("החזרה מהארכיון של פנייה שנענתה מחזירה ל'נענה'", async ({ page }) => {
    // Arrange
    const { id } = await seedSubmission();
    seeded.push(id);
    const service = serviceClient();
    const { data: admins } = await service.auth.admin.listUsers();
    const adminUser = admins?.users.find((user) =>
      (user.app_metadata?.roles as string[] | undefined)?.includes("admin"),
    );
    await service.from("contact_submission_replies").insert({
      submission_id: id,
      author_id: adminUser?.id ?? null,
      author_name: "מנהל",
      body: "תשובה קודמת",
      sent_to: "x@kol-mitzhalot.test",
    });
    await service
      .from("contact_submissions")
      .update({ status: "archived" })
      .eq("id", id);

    // Act
    await page.setViewportSize(DESKTOP);
    await page.goto(`${PAGE_PATH}?id=${id}`);
    const detail = page.getByTestId("submission-detail");
    await expect(detail.getByTestId("submission-reply-item")).toBeVisible(LOAD);
    await detail.getByRole("button", { name: "החזרה מהארכיון" }).click();

    // Assert
    await expect(detail.getByRole("button", { name: "לארכיון" })).toBeVisible(
      LOAD,
    );
    const { data } = await service
      .from("contact_submissions")
      .select("status")
      .eq("id", id)
      .single();
    expect(data?.status).toBe("replied");
  });

  test("משתמש שאינו מנהל נחסם: route 403 ו-RLS על טבלת התשובות", async ({
    browser,
    playwright,
    baseURL,
  }) => {
    // Arrange
    const { id } = await seedSubmission();
    seeded.push(id);
    plainUser = await createSessionUser({ prefix: "reply-plain" });
    const userPage = await openPageAs(browser, plainUser);

    try {
      // Act + Assert: route עם סשן של משתמש רגיל
      const res = await userPage.request.post(
        `/api/v1/admin/contact-submissions/${id}/reply`,
        { data: { body: "ניסיון" } },
      );
      expect(res.status()).toBe(403);
    } finally {
      await userPage.context().close();
    }

    // בלי סשן בכלל (storageState ריק במפורש: אחרת יורש את סשן המנהל)
    const anonRequest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const res = await anonRequest.post(
        `/api/v1/admin/contact-submissions/${id}/reply`,
        { data: { body: "ניסיון" } },
      );
      expect(res.status()).toBe(401);
    } finally {
      await anonRequest.dispose();
    }

    // RLS: משתמש רגיל ואנונימי אינם קוראים ואינם מוסיפים תשובות
    const userClient = await apiClientFor(plainUser);
    const { error: insertError } = await userClient
      .from("contact_submission_replies")
      .insert({
        submission_id: id,
        author_id: plainUser.id,
        body: "עקיפה",
        sent_to: "x@kol-mitzhalot.test",
      });
    expect(insertError).not.toBeNull();
    const { data: visible } = await userClient
      .from("contact_submission_replies")
      .select("id")
      .eq("submission_id", id);
    expect(visible ?? []).toHaveLength(0);

    const { error: anonError } = await anonClient()
      .from("contact_submission_replies")
      .insert({ submission_id: id, body: "עקיפה", sent_to: "x@x.test" });
    expect(anonError).not.toBeNull();

    // וגם: משתמש רגיל אינו יכול לסמן פנייה כ"נענה"
    await userClient
      .from("contact_submissions")
      .update({ status: "replied" })
      .eq("id", id);
    const { data: after } = await serviceClient()
      .from("contact_submissions")
      .select("status")
      .eq("id", id)
      .single();
    expect(after?.status).toBe("new");
  });

  test("תשובה ריקה נדחית ב-route (400) ולא נשמרת", async ({ page }) => {
    const { id } = await seedSubmission();
    seeded.push(id);
    await page.goto("/app");

    const res = await page.request.post(
      `/api/v1/admin/contact-submissions/${id}/reply`,
      { data: { body: "   " } },
    );

    expect(res.status()).toBe(400);
    const { data } = await serviceClient()
      .from("contact_submission_replies")
      .select("id")
      .eq("submission_id", id);
    expect(data ?? []).toHaveLength(0);
  });
});
