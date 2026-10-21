import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addFavorite,
  readFavorites,
} from "../../../features/students/lib/favorites";
import { UNAPPROVED_FAVORITE_MESSAGE } from "../../../features/students/lib/third-party-card";
import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
  pageAs,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * כרטיס שלא אושר במלואו, במאגר של המנהל, ואישור "להצעות ממני בלבד":
 *   - ממתין: תג במאגר, בלי כוכב, addFavorite מסרב.
 *   - אישור בלעדי מדף הכרטיס (עם אישור), ואחריו חזרה לתור הממתינים.
 *   - בלעדי: תג "בלעדי למנהל" וכוכב למנהל; שדכן אינו רואה ואינו מציע; מי
 *     שקיבל הצעה מהמנהל רואה אותו דרך ההצעה; בעל הכרטיס רואה "מאושר".
 *   - אישור מלא מבלעדי מציג אותו לשדכנים; החזרה להמתנה אפשרית.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
const LAST = `בלעדי${T}`;
const FULL_NAME = `מועמד ${LAST}`;
const LOAD_TIMEOUT = 60_000;
const BLOCK_CODE = "card_pending_approval";

let svc: SupabaseClient;
let adminId = "";
let shadchanId = "";
let ownerId = "";
let cardId = "";
let brideId = "";
let previousFavorites: unknown;

function poolRow(page: Page) {
  return page.getByRole("row", { name: new RegExp(LAST) });
}

async function openPool(page: Page) {
  await page.goto("/app/students");
  await page.locator("#search").fill(LAST);
  await expect(page.locator("#search")).toHaveValue(LAST);
  await expect(poolRow(page)).toBeVisible({ timeout: LOAD_TIMEOUT });
}

async function approvalRow() {
  const { data } = await svc
    .from("students")
    .select("admin_approved_at, admin_exclusive_at, admin_exclusive_by")
    .eq("id", cardId)
    .single();
  return data;
}

test.describe("אישור בלעדי למנהל וסימון כרטיס לא מאושר במאגר", () => {
  // הדפים של המנהל (התור, הלוח) כבדים בשרת הפיתוח
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async () => {
    svc = createServiceClient();
    adminId = await getTestUserId(svc, ADMIN_EMAIL);
    shadchanId = await getTestUserId(svc);
    ownerId = await ensureCardManagerId(svc);
    const { data: adminUser } = await svc.auth.admin.getUserById(adminId);
    previousFavorites = adminUser.user?.user_metadata?.favorites;

    // הכרטיס ממתין לאישור: נזרע בלי admin_approved_at
    const { data, error } = await svc
      .from("students")
      .insert({
        user_id: ownerId,
        first_name: "מועמד",
        last_name: LAST,
        birth_date: "1999-02-02",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        card_for: "child",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
    cardId = data.id as string;

    // הצד השני: כרטיס מאושר של הורה אחר (מקבל ההצעה)
    const secondParentId = await ensureSecondParentId(svc);
    brideId = await createCard(svc, {
      userId: secondParentId,
      gender: "female",
      firstName: "מיועדת",
      lastName: `צדשני${T}`,
    });
  });

  test.afterAll(async () => {
    const { data } = await svc.auth.admin.getUserById(adminId);
    await svc.auth.admin.updateUserById(adminId, {
      user_metadata: {
        ...(data.user?.user_metadata ?? {}),
        favorites: Array.isArray(previousFavorites) ? previousFavorites : [],
      },
    });
    await svc.from("students").delete().in("id", [cardId, brideId]);
  });

  test("ממתין: במאגר של המנהל יש תג, אין כוכב, ו-addFavorite מסרב", async ({
    page,
  }) => {
    // Act
    await openPool(page);
    const adminClient = await clientAs(svc, ADMIN_EMAIL);
    const refused = await addFavorite(adminClient, cardId);

    // Assert
    const tag = poolRow(page).getByTestId("card-approval-tag");
    await expect(tag).toHaveAttribute("data-status", "pending");
    await expect(tag).toHaveText("ממתין לאישור ההנהלה");
    await expect(
      poolRow(page).getByRole("button", { name: /מועדפים/ }),
    ).toHaveCount(0);
    expect(refused).toEqual({
      ok: false,
      message: UNAPPROVED_FAVORITE_MESSAGE,
    });
  });

  test("אישור להצעות ממני בלבד מדף הכרטיס: אישור בדיאלוג וחזרה לתור הממתינים", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${cardId}`);
    const controls = page.getByTestId("card-approval-controls");
    await expect(controls).toHaveAttribute("data-status", "pending", {
      timeout: LOAD_TIMEOUT,
    });

    // Act
    await controls
      .getByRole("button", {
        name: `אישור להצעות ממני בלבד (לא יופיע במאגר): ${FULL_NAME}`,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("לא יופיע במאגר");
    await dialog
      .getByRole("button", { name: "אישור להצעות ממני בלבד" })
      .click();

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/new-cards$/, {
      timeout: LOAD_TIMEOUT,
    });
    const row = await approvalRow();
    expect(row?.admin_approved_at).not.toBeNull();
    expect(row?.admin_exclusive_at).not.toBeNull();
    expect(row?.admin_exclusive_by).toBe(adminId);
  });

  test("בלעדי: למנהל תג וכוכב, והוא עולה ללוח העבודה", async ({ page }) => {
    // Act
    await openPool(page);

    // Assert
    const tag = poolRow(page).getByTestId("card-approval-tag");
    await expect(tag).toHaveAttribute("data-status", "exclusive");
    await expect(tag).toHaveText("בלעדי למנהל");
    await poolRow(page).getByRole("button", { name: "הוסף למועדפים" }).click();
    await expect
      .poll(
        async () =>
          readFavorites((await svc.auth.admin.getUserById(adminId)).data.user),
        { timeout: LOAD_TIMEOUT },
      )
      .toContain(cardId);
    await page.goto("/app/canvas");
    await expect(page.getByText(LAST).first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
  });

  test("בלעדי: שדכן אינו רואה ואינו מציע; מנהל מציע, והצד השני רואה דרך ההצעה", async () => {
    // Arrange
    const shadchan = await clientAs(svc, TEST_USER_EMAIL);
    const recipient = await clientAs(
      svc,
      "playwright-second-parent@kol-mitzhalot.test",
    );

    // Act
    const view = await shadchan
      .from("student_cards")
      .select("id")
      .eq("id", cardId);
    const table = await shadchan.from("students").select("id").eq("id", cardId);
    const access = await shadchan.rpc("get_student_card_access", {
      sid: cardId,
    });
    const byShadchan = await svc.from("shidduchim").insert({
      groom_id: cardId,
      bride_id: brideId,
      shadchan_id: shadchanId,
      status: "draft",
    });
    const before = await recipient.rpc("get_student_card_access", {
      sid: cardId,
    });
    const byAdmin = await svc.from("shidduchim").insert({
      groom_id: cardId,
      bride_id: brideId,
      shadchan_id: adminId,
      status: "sent",
      recipient_scope: "both",
      sent_at: new Date().toISOString(),
    });
    const after = await recipient.rpc("get_student_card_access", {
      sid: cardId,
    });

    // Assert
    expect(view.data).toEqual([]);
    expect(table.data).toEqual([]);
    expect(access.data?.[0]?.access_level).toBe("none");
    expect(byShadchan.error?.message).toBe(BLOCK_CODE);
    expect(before.data?.[0]?.access_level).toBe("none");
    expect(byAdmin.error).toBeNull();
    expect(after.data?.[0]?.access_level).toBe("proposal");
  });

  test("בלעדי: בעל הכרטיס רואה 'מאושר' בלי הסבר המתנה, וההתראה אינה 'מוצג לשדכנים'", async ({
    browser,
  }) => {
    // Act
    const owner = await pageAs(
      browser,
      svc,
      CARD_MANAGER_EMAIL,
      `/app/students/${cardId}`,
    );
    const ownerClient = await clientAs(svc, CARD_MANAGER_EMAIL);
    const { data: ownView } = await ownerClient
      .from("student_cards")
      .select("admin_approved_at, admin_exclusive_at")
      .eq("id", cardId)
      .single();
    const { data: notices } = await svc
      .from("notifications")
      .select("body")
      .eq("user_id", ownerId)
      .eq("type", "card_approved")
      .eq("related_id", cardId);

    // Assert
    await expect(
      owner.getByRole("heading", { level: 1, name: new RegExp(LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(owner.getByTestId("card-approval-banner")).toHaveCount(0);
    expect(ownView?.admin_approved_at).not.toBeNull();
    expect(ownView?.admin_exclusive_at).toBeNull();
    expect(notices).toHaveLength(1);
    expect(notices?.[0]?.body).not.toContain("מוצג לשדכנים");
    await owner.context().close();
  });

  test("אישור מלא מבלעדי מציג לשדכנים; החזרה להמתנה מבלעדי אפשרית", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${cardId}`);
    const controls = page.getByTestId("card-approval-controls");
    await expect(controls).toHaveAttribute("data-status", "exclusive", {
      timeout: LOAD_TIMEOUT,
    });

    // Act: אישור מלא
    await controls
      .getByRole("button", { name: `אישור הכרטיס של ${FULL_NAME}` })
      .click();

    // Assert
    await expect(page).toHaveURL(/\/app\/admin\/new-cards$/, {
      timeout: LOAD_TIMEOUT,
    });
    expect((await approvalRow())?.admin_exclusive_at).toBeNull();
    const shadchan = await clientAs(svc, TEST_USER_EMAIL);
    const { data: visible } = await shadchan
      .from("student_cards")
      .select("id")
      .eq("id", cardId);
    expect(visible).toEqual([{ id: cardId }]);

    // Act: שוב בלעדי, ואז החזרה להמתנה - דרך הנתיב
    const exclusive = await page.request.patch(
      `/api/v1/students/${cardId}/approval`,
      { data: { action: "exclusive" } },
    );
    const reset = await page.request.patch(
      `/api/v1/students/${cardId}/approval`,
      { data: { action: "reset" } },
    );

    // Assert
    expect(exclusive.status(), await exclusive.text()).toBe(200);
    expect(reset.status(), await reset.text()).toBe(200);
    expect(await approvalRow()).toEqual({
      admin_approved_at: null,
      admin_exclusive_at: null,
      admin_exclusive_by: null,
    });
  });

  test("מסד: רק מנהל קובע בלעדיות, ובלעדי רק לכרטיס מאושר", async () => {
    // Arrange
    const ownerClient = await clientAs(svc, CARD_MANAGER_EMAIL);

    // Act
    const byOwner = await ownerClient
      .from("students")
      .update({ admin_exclusive_at: new Date().toISOString() })
      .eq("id", cardId);
    const unapproved = await svc
      .from("students")
      .update({ admin_exclusive_at: new Date().toISOString() })
      .eq("id", cardId);

    // Assert
    expect(byOwner.error?.message).toBe("student_approval_forbidden");
    expect(unapproved.error?.message).toContain(
      "students_admin_exclusive_state_check",
    );
  });
});
