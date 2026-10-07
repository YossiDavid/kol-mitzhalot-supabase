/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן).
 * API: /app/forums, /app/shadchanim, /api/v1/forum/* ← forum_* (RLS: שדכן מאושר או מנהל).
 * User: "פורום שדכנים ורשימת שדכנים להפעיל".
 */
import { expect, test } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

const RUN_ID = Date.now();
const POST_TITLE = `פוסט בדיקה ${RUN_ID}`;
const POST_BODY = "תוכן הפוסט לבדיקה";
const REPLY_TEXT = `תגובת בדיקה ${RUN_ID}`;

async function setShadchanApproval(
  userId: string,
  status: "approved" | "pending",
) {
  const { error } = await createServiceClient()
    .from("shadchanim_info")
    .upsert(
      { user_id: userId, application_status: status },
      { onConflict: "user_id" },
    );
  expect(error).toBeNull();
}

test.describe("פורום שדכנים", () => {
  test.describe.configure({ mode: "serial" });

  let userId = "";

  test.beforeAll(async () => {
    userId = await getTestUserId(createServiceClient());
  });

  test.afterAll(async () => {
    const service = createServiceClient();
    await service.from("forum_posts").delete().eq("title", POST_TITLE);
    await service.from("shadchanim_info").delete().eq("user_id", userId);
  });

  test("שדכן שממתין לאישור רואה הסבר ולא עמוד ריק", async ({ page }) => {
    // Arrange
    await setShadchanApproval(userId, "pending");

    // Act
    await page.goto("/app/forums");

    // Assert
    await expect(page.getByTestId("forum-access-notice")).toBeVisible();
    await expect(page.getByText("ממתינה לאישור")).toBeVisible();
    await expect(page.getByRole("button", { name: "פוסט חדש" })).toHaveCount(0);
  });

  test("שדכן מאושר מפרסם פוסט, מגיב ומסמן לייק", async ({ page }) => {
    // Arrange
    await setShadchanApproval(userId, "approved");
    await page.goto("/app/forums");

    // Act — פוסט
    await page.getByRole("button", { name: "פוסט חדש" }).click();
    await page.getByLabel("כותרת").fill(POST_TITLE);
    await page.getByLabel("תוכן").fill(POST_BODY);
    await page.getByRole("button", { name: "פרסם", exact: true }).click();

    // Assert — הפוסט ברשימה
    await expect(page.getByRole("link", { name: POST_TITLE })).toBeVisible({
      timeout: 15_000,
    });

    // Act — תגובה
    await page.getByRole("link", { name: POST_TITLE }).click();
    await page.getByLabel("הוספת תגובה").fill(REPLY_TEXT);
    await page.getByRole("button", { name: "פרסום תגובה" }).click();

    // Assert
    await expect(page.getByText(REPLY_TEXT)).toBeVisible({ timeout: 15_000 });

    // Act — לייק לפוסט
    const likeButton = page
      .getByRole("button", { name: "לייק", exact: true })
      .first();
    await likeButton.click();

    // Assert
    await expect(
      page.getByRole("button", { name: "ביטול לייק" }).first(),
    ).toBeVisible();
  });

  test("פוסט שלא קיים מציג 404 עם noindex", async ({ page }) => {
    // Act
    await page.goto("/app/forums/00000000-0000-0000-0000-000000000000");

    // Assert - תחת Cache Components התשובה כבר זורמת כ-200, ולכן ההגנה
    // מפני אינדוקס היא תג noindex ועמוד "לא נמצא", לא קוד סטטוס.
    await expect(page.getByText("הדף שחיפשת לא נמצא")).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("פריט 'פורום שדכנים' מופיע בתפריט הצד של שדכן", async ({ page }) => {
    // Act
    await page.goto("/app");

    // Assert
    const sidebar = page.locator('[data-sidebar="content"]');
    await expect(
      sidebar.getByRole("link", { name: "פורום שדכנים" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      sidebar.getByRole("link", { name: "שדכנים", exact: true }),
    ).toBeVisible();
  });
});

test.describe("רשימת שדכנים", () => {
  test("העמוד נטען עם כותרת ורשימה או מצב ריק, בלי stub", async ({ page }) => {
    // Act
    await page.goto("/app/shadchanim");

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: "שדכנים" }),
    ).toBeVisible();
    await expect(page.getByText("ShadchanimPage")).toHaveCount(0);
    const hasItems = (await page.getByTestId("shadchan-list-item").count()) > 0;
    if (!hasItems) {
      await expect(page.getByText("עדיין אין שדכנים ברשימה")).toBeVisible();
    }
  });

  test("שדכן מאושר אחר מופיע ברשימה ולא כולל טלפון ומייל", async ({ page }) => {
    // Arrange
    const service = createServiceClient();
    const email = `list-shadchan-${RUN_ID}@kol-mitzhalot.test`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      phone: `+9725${String(RUN_ID).slice(-8)}`,
      email_confirm: true,
      phone_confirm: true,
      app_metadata: { roles: ["shadchan"] },
      user_metadata: { firstName: "רשימה", lastName: `בדיקה${RUN_ID}` },
    });
    expect(error).toBeNull();
    const otherId = data.user!.id;
    await service.from("user_profiles").upsert({
      id: otherId,
      first_name: "רשימה",
      last_name: `בדיקה${RUN_ID}`,
    });
    await service.from("shadchanim_info").upsert(
      {
        user_id: otherId,
        application_status: "approved",
        contact_phone: "050-1234567",
        contact_email: email,
      },
      { onConflict: "user_id" },
    );

    try {
      // Act
      await page.goto("/app/shadchanim");

      // Assert
      const item = page
        .getByTestId("shadchan-list-item")
        .filter({ hasText: `בדיקה${RUN_ID}` });
      await expect(item).toBeVisible();
      await expect(item.getByText("050-1234567")).toHaveCount(0);
      await expect(item.getByText(email)).toHaveCount(0);
      await expect(
        item.getByRole("link", { name: "לפרופיל המלא" }),
      ).toBeVisible();
    } finally {
      await service.auth.admin.deleteUser(otherId);
    }
  });
});
