import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";
import {
  clearEvents,
  daysAgo,
  hoursAgo,
  seedEvent,
} from "../shidduchim/proposal-events";

const PAGE_SIZE = 25;
const REPORT_PATH = "/app/admin/proposals";

/**
 * דוח ההצעות לניהול: יומן השליחות עם סינון לפי שדכן, כרטיס ותאריכים,
 * עימוד בשרת, והסטטוס הנוכחי ("נמחקה" כשההצעה כבר לא קיימת). מנהל בלבד.
 */
test.describe("דוח הצעות (ניהול)", () => {
  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let cardIds: string[];

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    cardIds = [fx.groomFirst, fx.groomSecond, fx.brideFirst, fx.brideSecond];
  });

  test.afterAll(async () => {
    await clearEvents(admin, cardIds);
    await teardownShidduchFixtures(admin, fx);
  });

  test.beforeEach(async () => {
    await clearEvents(admin, cardIds);
    await admin.from("shidduchim").delete().eq("groom_id", fx.groomFirst);
  });

  test("מציג שדכן (עם קישור), כרטיסים, צד וסטטוס; הצעה שנמחקה מסומנת", async ({
    page,
  }) => {
    // Arrange - הצעה קיימת (סטטוס "נשלחה") והצעה שנמחקה
    const { data: live } = await admin
      .from("shidduchim")
      .insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideFirst,
        shadchan_id: shadchanId,
        status: "sent",
        recipient_scope: "bride_only",
        sent_at: hoursAgo(2).toISOString(),
      })
      .select("id")
      .single();
    expect(live).not.toBeNull();
    await seedEvent(admin, {
      shadchanId,
      shadchanName: "שדכן לדוגמה",
      studentId: fx.groomSecond,
      otherStudentId: fx.brideSecond,
      side: "groom",
      createdAt: hoursAgo(5),
    });

    // Act
    await page.goto(`${REPORT_PATH}?card=${fx.brideFirst}`);

    // Assert - האירוע שנכתב ע"י הטריגר (בצד הכלה) עם הסטטוס הנוכחי
    const liveRow = page.getByRole("row").filter({ hasText: "מיועדת" }).first();
    await expect(liveRow).toContainText("צד המיועדת");
    await expect(liveRow).toContainText("נשלחה");
    await expect(
      liveRow.getByRole("link", { name: /Test User/ }),
    ).toHaveAttribute("href", `/app/admin/users/${shadchanId}`);

    // Act - הצעה שנמחקה
    await admin.from("shidduchim").delete().eq("id", live!.id);
    await page.goto(`${REPORT_PATH}?card=${fx.brideFirst}`);

    // Assert
    await expect(page.getByText("נמחקה").first()).toBeVisible();
  });

  test("סינון לפי כרטיס, שדכן ותאריכים", async ({ page }) => {
    // Arrange
    await seedEvent(admin, {
      shadchanId,
      shadchanName: "אברהם הראשון",
      studentId: fx.groomFirst,
      otherStudentId: fx.brideFirst,
      side: "groom",
      createdAt: hoursAgo(3),
    });
    await seedEvent(admin, {
      shadchanId: fx.otherShadchanId,
      shadchanName: "יצחק השני",
      studentId: fx.groomSecond,
      otherStudentId: fx.brideFirst,
      side: "groom",
      createdAt: daysAgo(10),
    });

    // Act + Assert - לפי כרטיס
    await page.goto(`${REPORT_PATH}?card=${fx.groomSecond}`);
    await expect(page.getByText("יצחק השני").first()).toBeVisible();
    await expect(page.getByText("אברהם הראשון")).toHaveCount(0);

    // לפי שם שדכן
    await page.goto(`${REPORT_PATH}?shadchan=${encodeURIComponent("אברהם")}`);
    await expect(page.getByText("אברהם הראשון").first()).toBeVisible();
    await expect(page.getByText("יצחק השני").first()).toHaveCount(0);

    // לפי מזהה שדכן
    await page.goto(
      `${REPORT_PATH}?shadchan=${fx.otherShadchanId}&card=${fx.groomSecond}`,
    );
    await expect(page.getByText("יצחק השני").first()).toBeVisible();

    // טווח תאריכים שאינו כולל את האירוע מלפני 10 ימים
    const from = daysAgo(2).toISOString().slice(0, 10);
    await page.goto(`${REPORT_PATH}?card=${fx.groomSecond}&from=${from}`);
    await expect(page.getByText("יצחק השני").first()).toHaveCount(0);
    await expect(page.getByText("לא נמצאו הצעות לפי הסינון")).toBeVisible();
  });

  test("עימוד בשרת: 25 בעמוד, והשאר בעמוד הבא", async ({ page }) => {
    // Arrange - 27 אירועים לכרטיס אחד
    for (let index = 0; index < PAGE_SIZE + 2; index += 1) {
      await seedEvent(admin, {
        shadchanId,
        studentId: fx.groomFirst,
        otherStudentId: fx.brideFirst,
        side: "groom",
        createdAt: hoursAgo(index + 1),
      });
    }

    // Act
    await page.goto(`${REPORT_PATH}?card=${fx.groomFirst}`);

    // Assert
    await expect(page.getByText(`מתוך ${PAGE_SIZE + 2}`).first()).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "כרטיס בדיקה" }),
    ).toHaveCount(PAGE_SIZE);

    await page.getByRole("link", { name: "הבא" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(
      page.getByRole("row").filter({ hasText: "כרטיס בדיקה" }),
    ).toHaveCount(2);
  });

  test("בעמוד פרטי המשתמש: מספר ההצעות שהכרטיס קיבל, מקושר לדוח המסונן", async ({
    page,
  }) => {
    // Arrange - שתי הצעות למיועד, אחת למיועדת
    for (const [studentId, side] of [
      [fx.groomFirst, "groom"],
      [fx.groomFirst, "groom"],
      [fx.brideFirst, "bride"],
    ] as const) {
      await seedEvent(admin, {
        shadchanId,
        studentId,
        otherStudentId: fx.groomSecond,
        side,
        createdAt: hoursAgo(1),
      });
    }

    // Act
    await page.goto(`/app/admin/users/${fx.cardManagerId}`);

    // Assert
    const groomCount = page
      .getByTestId(`received-count-${fx.groomFirst}`)
      .first();
    await expect(groomCount).toHaveText("2");
    await expect(
      page.getByTestId(`received-count-${fx.brideFirst}`).first(),
    ).toHaveText("1");
    await expect(groomCount).toHaveAttribute(
      "href",
      `${REPORT_PATH}?card=${fx.groomFirst}`,
    );
  });

  test("הדוח מקושר מדף הניהול", async ({ page }) => {
    // Act
    await page.goto("/app/admin");
    await page.getByRole("link", { name: /דוח הצעות/ }).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`${REPORT_PATH}$`));
    await expect(
      page.getByRole("heading", { name: "דוח הצעות" }),
    ).toBeVisible();
  });
});
