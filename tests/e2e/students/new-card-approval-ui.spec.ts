import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureSecondParentId, pageAs } from "../chats/context-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * אישור הנהלה לכרטיס חדש, דרך הדפים האמיתיים: הורה יוצר כרטיס בנתיב של הטופס
 * ורואה "ממתין לאישור"; השדכן אינו רואה אותו; המנהל רואה אותו בתור, דוחה עם
 * סיבה (חובה), ההורה רואה את הסיבה ושולח לאישור מחדש; המנהל מאשר, והשדכן
 * רואה את הכרטיס עם התג "חדש היום".
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const T = `${Date.now()}`.slice(-8);
const LAST = `תור${T}`;
const FULL_NAME = `ממתין ${LAST}`;
const REASON = `חסר שם האם, נא להשלים ${T}`;
const LOAD_TIMEOUT = 20_000;

let svc: SupabaseClient;
let parentId: string;
let adminId: string;
let cardId = "";

function rowFor(page: Page) {
  return page.getByRole("row", { name: new RegExp(LAST) });
}

async function pendingCount(page: Page): Promise<number> {
  const text = await page.getByTestId("pending-count-newCards").innerText();
  return Number(text.replace(/\D/g, ""));
}

test.describe("אישור הנהלה לכרטיס חדש (דפים)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    svc = createServiceClient();
    parentId = await ensureSecondParentId(svc);
    const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
    const adminUser = data.users.find((user) => user.email === ADMIN_EMAIL);
    if (!adminUser) throw new Error("משתמש המנהל לא נמצא - האם הסטאפ רץ?");
    adminId = adminUser.id;
  });

  test.afterAll(async () => {
    if (cardId) await deleteCards(svc, [cardId]);
  });

  test("הורה יוצר כרטיס בנתיב של הטופס: ממתין לאישור, עם הסבר בכרטיס ותג בלוח הבקרה", async ({
    browser,
  }) => {
    // Arrange
    const parent = await pageAs(browser, svc, SECOND_PARENT_EMAIL, "/app");

    // Act: אותו נתיב שהטופס שולח אליו, כולל ניסיון לאשר דרך ה-payload
    const created = await parent.request.post("/api/v1/students", {
      headers: { Origin: BASE_URL },
      data: {
        payload: {
          first_name: "ממתין",
          last_name: LAST,
          birth_date: "2001-03-03",
          gender: "male",
          personal_status: "single",
          country: "ישראל",
          city: "בני ברק",
          card_for: "child",
          admin_approved_at: new Date().toISOString(),
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    cardId = (await created.json()).id;
    const faked = await parent.request.put(
      `/api/v1/students/${cardId}/profile`,
      {
        headers: { Origin: BASE_URL },
        data: {
          payload: {
            first_name: "ממתין",
            last_name: LAST,
            birth_date: "2001-03-03",
            gender: "male",
            personal_status: "single",
            country: "ישראל",
            city: "בני ברק",
            card_for: "child",
            admin_approved_at: new Date().toISOString(),
          },
        },
      },
    );
    expect(faked.status(), await faked.text()).toBe(200);

    // Assert
    const { data: row } = await svc
      .from("students")
      .select("user_id, admin_approved_at, admin_rejected_at")
      .eq("id", cardId)
      .single();
    expect(row).toEqual({
      user_id: parentId,
      admin_approved_at: null,
      admin_rejected_at: null,
    });

    await parent.goto(`/app/students/${cardId}`);
    const banner = parent.getByTestId("card-approval-banner");
    await expect(banner).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(banner).toHaveAttribute("data-status", "pending");
    await expect(banner).toContainText("ממתין לאישור ההנהלה");
    await expect(
      banner.getByRole("button", { name: "שליחה לאישור מחדש" }),
    ).toHaveCount(0);

    await parent.goto("/app");
    const tag = parent
      .getByRole("row", { name: new RegExp(LAST) })
      .getByTestId("card-approval-tag");
    await expect(tag).toHaveText("ממתין לאישור ההנהלה", {
      timeout: LOAD_TIMEOUT,
    });
    await parent.context().close();
  });

  test("לפני האישור: השדכן אינו רואה את הכרטיס ברשימה, בדף, בתמונות או בקישור הציבורי", async ({
    page,
    browser,
  }) => {
    // Act: הרשימה
    await page.goto("/app/students");
    await page.locator("#search").fill(LAST);
    await expect(page.locator("#search")).toHaveValue(LAST);
    await page.waitForLoadState("networkidle");
    await expect(rowFor(page)).toHaveCount(0);

    // דף הכרטיס
    await page.goto(`/app/students/${cardId}`);
    await expect(page.getByText("הכרטיס אינו זמין")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByText(LAST)).toHaveCount(0);

    // הנתיבים של התמונות וההערות
    const gallery = await page.request.get(`/api/v1/students/${cardId}/photos`);
    const thumbnails = await page.request.post(
      "/api/v1/students/photos/thumbnails",
      { headers: { Origin: BASE_URL }, data: { studentIds: [cardId] } },
    );
    const note = await page.request.post(`/api/v1/students/${cardId}/notes`, {
      headers: { Origin: BASE_URL },
      data: { body: "הערה על כרטיס חבוי", kind: "shadchan_note" },
    });

    // Assert
    expect(gallery.status()).toBe(404);
    expect(thumbnails.status()).toBe(200);
    expect((await thumbnails.json()).thumbnails).toEqual({});
    // ההערה נדחית בהרשאה (403), לא בגלל גוף בקשה שגוי
    expect(note.status()).toBe(403);
    const { count } = await svc
      .from("student_notes")
      .select("id", { count: "exact", head: true })
      .eq("student_id", cardId);
    expect(count).toBe(0);

    // הקישור הציבורי, בלי התחברות
    const anonymous = await browser.newContext({ locale: "he-IL" });
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`${BASE_URL}/app/students/${cardId}`);
    await expect(publicPage.getByText("הכרטיס אינו זמין")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    expect(await publicPage.content()).not.toContain(LAST);
    await anonymous.close();
  });

  test("המנהל: כניסה מהתפריט ומלוח הבקרה, הכרטיס בתור, דחייה דורשת סיבה", async ({
    browser,
  }) => {
    // Arrange
    const admin = await pageAs(browser, svc, ADMIN_EMAIL, "/app/admin");

    // Assert: לוח הבקרה והתפריט
    await expect(admin.getByTestId("pending-newCards")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    const before = await pendingCount(admin);
    expect(before).toBeGreaterThanOrEqual(1);
    await admin.getByTestId("pending-newCards").click();
    await expect(admin).toHaveURL(/\/app\/admin\/new-cards/);
    await expect(
      admin.getByRole("heading", { name: "כרטיסים חדשים לאישור" }),
    ).toBeVisible();

    // הכרטיס בתור, עם קישור לכרטיס המלא
    const row = admin.getByRole("row", { name: new RegExp(LAST) });
    await expect(row).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(
      row.getByRole("link", { name: FULL_NAME, exact: true }),
    ).toHaveAttribute("href", `/app/students/${cardId}`);
    await expect(row.getByTestId(`approval-status-${cardId}`)).toHaveAttribute(
      "data-status",
      "pending",
    );

    // Act: דחייה בלי סיבה אינה נשלחת
    await row
      .getByRole("button", { name: `דחיית הכרטיס של ${FULL_NAME}` })
      .click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const submit = dialog.getByRole("button", { name: "דחיית הכרטיס" });
    await expect(submit).toBeDisabled();
    await dialog.getByRole("textbox").fill("   ");
    await expect(submit).toBeDisabled();

    // עם סיבה
    await dialog.getByRole("textbox").fill(REASON);
    await submit.click();
    await expect(dialog).toBeHidden({ timeout: LOAD_TIMEOUT });

    // Assert
    await expect(row).toHaveCount(0, { timeout: LOAD_TIMEOUT });
    const { data: rejected } = await svc
      .from("students")
      .select("admin_approved_at, admin_rejected_by, admin_rejection_reason")
      .eq("id", cardId)
      .single();
    expect(rejected).toEqual({
      admin_approved_at: null,
      admin_rejected_by: adminId,
      admin_rejection_reason: REASON,
    });
    await admin.goto("/app/admin/new-cards?filter=rejected");
    await expect(
      admin.getByRole("row", { name: new RegExp(LAST) }),
    ).toContainText(REASON);
    await admin.goto("/app/admin");
    await expect(admin.getByTestId("pending-newCards")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    expect(await pendingCount(admin)).toBe(before - 1);
    await admin.context().close();
  });

  test("ההורה רואה 'נדחה' עם הסיבה, מקבל התראה, ושולח לאישור מחדש", async ({
    browser,
  }) => {
    // Arrange
    const parent = await pageAs(
      browser,
      svc,
      SECOND_PARENT_EMAIL,
      `/app/students/${cardId}`,
    );

    // Assert
    const banner = parent.getByTestId("card-approval-banner");
    await expect(banner).toHaveAttribute("data-status", "rejected", {
      timeout: LOAD_TIMEOUT,
    });
    await expect(parent.getByTestId("card-rejection-reason")).toContainText(
      REASON,
    );
    const { data: notice } = await svc
      .from("notifications")
      .select("body, link")
      .eq("user_id", parentId)
      .eq("type", "card_rejected")
      .eq("related_id", cardId);
    expect(notice).toHaveLength(1);
    expect(notice?.[0]?.body).toContain(REASON);
    expect(notice?.[0]?.link).toBe(`/app/students/${cardId}`);

    // Act
    await banner.getByRole("button", { name: "שליחה לאישור מחדש" }).click();

    // Assert
    await expect(banner).toHaveAttribute("data-status", "pending", {
      timeout: LOAD_TIMEOUT,
    });
    const { data: row } = await svc
      .from("students")
      .select("admin_approved_at, admin_rejected_at, admin_rejection_reason")
      .eq("id", cardId)
      .single();
    expect(row).toEqual({
      admin_approved_at: null,
      admin_rejected_at: null,
      admin_rejection_reason: null,
    });
    const { count } = await svc
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", adminId)
      .eq("type", "card_pending_approval")
      .eq("related_id", cardId);
    // אחת על היצירה, ואחת על השליחה מחדש
    expect(count).toBe(2);
    await parent.context().close();
  });

  test("המנהל מאשר מדף הכרטיס; השדכן רואה את הכרטיס ברשימה עם 'חדש היום', וההורה מקבל התראה", async ({
    page,
    browser,
  }) => {
    // Arrange: הכרטיס "נוצר" לפני עשרה ימים - התג נמדד מרגע האישור
    await svc
      .from("students")
      .update({
        created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      })
      .eq("id", cardId);
    const admin = await pageAs(
      browser,
      svc,
      ADMIN_EMAIL,
      `/app/students/${cardId}`,
    );
    const controls = admin.getByTestId("card-approval-controls");
    await expect(controls).toHaveAttribute("data-status", "pending", {
      timeout: LOAD_TIMEOUT,
    });

    // Act
    await controls
      .getByRole("button", { name: `אישור הכרטיס של ${FULL_NAME}` })
      .click();

    // Assert
    await expect(controls).toHaveAttribute("data-status", "approved", {
      timeout: LOAD_TIMEOUT,
    });
    await admin.context().close();
    const { data: row } = await svc
      .from("students")
      .select("admin_approved_by, admin_rejected_at")
      .eq("id", cardId)
      .single();
    expect(row).toEqual({
      admin_approved_by: adminId,
      admin_rejected_at: null,
    });
    const { count } = await svc
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", parentId)
      .eq("type", "card_approved")
      .eq("related_id", cardId);
    expect(count).toBe(1);

    await page.goto("/app/students");
    await page.locator("#search").fill(LAST);
    await expect(rowFor(page)).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(rowFor(page).getByTestId("new-card-badge")).toHaveText(
      "חדש היום",
    );
    await page.locator("#newCards").selectOption("today");
    await expect(rowFor(page)).toBeVisible({ timeout: LOAD_TIMEOUT });

    // ההורה: בלי הודעת סטטוס
    const parent = await pageAs(
      browser,
      svc,
      SECOND_PARENT_EMAIL,
      `/app/students/${cardId}`,
    );
    await expect(
      parent.getByRole("heading", { level: 1, name: new RegExp(LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(parent.getByTestId("card-approval-banner")).toHaveCount(0);
    await parent.context().close();
  });

  test("שדכן שיוצר כרטיס: גם הוא ממתין, והוא רואה את ההסבר", async ({
    page,
  }) => {
    // Act
    const created = await page.request.post("/api/v1/students", {
      headers: { Origin: BASE_URL },
      data: {
        payload: {
          first_name: "שדכן-יוצר",
          last_name: LAST,
          birth_date: "2000-04-04",
          gender: "female",
          personal_status: "single",
          country: "ישראל",
          city: "בני ברק",
          card_for: "other",
        },
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const id: string = (await created.json()).id;

    // Assert
    const { data: row } = await svc
      .from("students")
      .select("admin_approved_at")
      .eq("id", id)
      .single();
    await page.goto(`/app/students/${id}`);
    const banner = page.getByTestId("card-approval-banner");
    await expect(banner).toHaveAttribute("data-status", "pending", {
      timeout: LOAD_TIMEOUT,
    });
    await deleteCards(svc, [id]);
    expect(row?.admin_approved_at).toBeNull();
  });
});
