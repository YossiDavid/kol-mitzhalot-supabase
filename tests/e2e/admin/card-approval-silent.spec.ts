import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { SILENT_REJECTION_DEFAULT_REASON } from "../../../features/students/lib/card-approval";
import { deleteCards } from "../students/third-party-card-fixtures";

/**
 * פעולות המנהל על כרטיס, בסשן של מנהל מול הנתיבים האמיתיים:
 *   - דחייה "ללא שליחת הודעה לבעל הכרטיס": בלי סיבה, בלי התראה לבעל הכרטיס.
 *   - "החזרה להמתנה" של כרטיס שנדחה: ממתין שוב, בלי התראה לאיש.
 *   - דחייה רגילה: עדיין דורשת סיבה ושולחת התראה.
 *   - סימון "במיקוד" עם הערה, והסרתו.
 *   - בתור הכרטיסים: מספר הכרטיסים על כל לשונית וכפתור "צפייה בכרטיס".
 */
const T = `${Date.now()}`.slice(-8);
const LAST = `שקט${T}`;

let svc: SupabaseClient;
let ownerId = "";
let cardId = "";

async function notificationCount(type: string): Promise<number> {
  const { count, error } = await svc
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .eq("related_id", cardId);
  expect(error, error?.message).toBeNull();
  return count ?? 0;
}

async function approvalOf() {
  const { data } = await svc
    .from("students")
    .select(
      "admin_approved_at, admin_rejected_at, admin_rejection_reason, admin_review_silent",
    )
    .eq("id", cardId)
    .single();
  return data;
}

test.beforeAll(async () => {
  svc = createServiceClient();
  ownerId = await ensureCardManagerId(svc);
  const { data, error } = await svc
    .from("students")
    .insert({
      user_id: ownerId,
      first_name: "ממתין",
      last_name: LAST,
      birth_date: "1998-01-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`כרטיס לבדיקה: ${error?.message}`);
  cardId = data.id as string;
});

test.afterAll(async () => {
  if (!cardId) return;
  await svc.from("notifications").delete().eq("related_id", cardId);
  await deleteCards(svc, [cardId]);
});

test.describe.serial("דחייה שקטה והחזרה להמתנה", () => {
  test("דחייה רגילה בלי סיבה נדחית", async ({ request }) => {
    // Act
    const response = await request.patch(
      `/api/v1/students/${cardId}/approval`,
      {
        data: { action: "reject", reason: "" },
      },
    );

    // Assert
    expect(response.status()).toBe(400);
    expect((await approvalOf())?.admin_rejected_at).toBeNull();
  });

  test("דחייה ללא הודעה: בלי סיבה ובלי התראה לבעל הכרטיס", async ({
    request,
  }) => {
    // Act
    const response = await request.patch(
      `/api/v1/students/${cardId}/approval`,
      {
        data: { action: "reject", silent: true },
      },
    );

    // Assert
    expect(response.status()).toBe(200);
    const approval = await approvalOf();
    expect(approval?.admin_rejected_at).not.toBeNull();
    expect(approval?.admin_rejection_reason).toBe(
      SILENT_REJECTION_DEFAULT_REASON,
    );
    expect(approval?.admin_review_silent).toBe(true);
    expect(await notificationCount("card_rejected")).toBe(0);
  });

  test("החזרה להמתנה: ממתין שוב, בלי התראה למנהלים ולבעלים", async ({
    request,
  }) => {
    // Arrange
    const pendingBefore = await notificationCount("card_pending_approval");

    // Act
    const response = await request.patch(
      `/api/v1/students/${cardId}/approval`,
      {
        data: { action: "reset" },
      },
    );
    const again = await request.patch(`/api/v1/students/${cardId}/approval`, {
      data: { action: "reset" },
    });

    // Assert
    expect(response.status()).toBe(200);
    expect(again.status()).toBe(409);
    const approval = await approvalOf();
    expect(approval?.admin_rejected_at).toBeNull();
    expect(approval?.admin_approved_at).toBeNull();
    expect(await notificationCount("card_pending_approval")).toBe(
      pendingBefore,
    );
    expect(await notificationCount("card_rejected")).toBe(0);
  });

  test("דחייה רגילה: סיבה חובה, והתראה לבעל הכרטיס", async ({ request }) => {
    // Act
    const response = await request.patch(
      `/api/v1/students/${cardId}/approval`,
      {
        data: { action: "reject", reason: "חסרים פרטים" },
      },
    );

    // Assert
    expect(response.status()).toBe(200);
    expect((await approvalOf())?.admin_review_silent).toBe(false);
    expect(await notificationCount("card_rejected")).toBe(1);
  });

  test("תור הכרטיסים: מספר על כל לשונית, וכפתור צפייה בכרטיס", async ({
    page,
  }) => {
    // Act
    await page.goto("/app/admin/new-cards?filter=rejected");

    // Assert
    await expect(page.getByTestId("new-cards-filter-rejected")).toHaveText(
      /נדחו \(\d+\)/,
    );
    const row = page.getByRole("row").filter({ hasText: LAST });
    await expect(
      row.getByRole("link", { name: `צפייה בכרטיס של ממתין ${LAST}` }),
    ).toHaveAttribute("href", `/app/students/${cardId}`);
    await expect(
      row.getByRole("button", {
        name: `החזרה להמתנה של הכרטיס של ממתין ${LAST}`,
      }),
    ).toBeVisible();
  });
});

test.describe("במיקוד", () => {
  test("מנהל מסמן עם הערה ומסיר", async ({ request }) => {
    // Act
    const marked = await request.patch(
      `/api/v1/students/${cardId}/admin-focus`,
      { data: { focused: true, note: "  להשקיע  " } },
    );
    const { data: focus } = await svc
      .from("student_admin_focus")
      .select("note, focused_by")
      .eq("student_id", cardId)
      .maybeSingle();
    const tooLong = await request.patch(
      `/api/v1/students/${cardId}/admin-focus`,
      { data: { focused: true, note: "א".repeat(201) } },
    );
    const removed = await request.patch(
      `/api/v1/students/${cardId}/admin-focus`,
      { data: { focused: false } },
    );
    const { count } = await svc
      .from("student_admin_focus")
      .select("student_id", { count: "exact", head: true })
      .eq("student_id", cardId);

    // Assert
    expect(marked.status()).toBe(200);
    expect(focus?.note).toBe("להשקיע");
    expect(focus?.focused_by).not.toBeNull();
    expect(tooLong.status()).toBe(400);
    expect(removed.status()).toBe(200);
    expect(count).toBe(0);
  });
});
