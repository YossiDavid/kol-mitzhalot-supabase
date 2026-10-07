/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן מאושר).
 * Bug: formatForumDate רץ בשרת (UTC) בלי timeZone, והשעה המוצגת זזה משעון
 * ישראל. הבדיקה מדויקת כשהשרת רץ ב-TZ=UTC; בשרת שכבר בשעון ישראל היא עוברת
 * גם בלי התיקון.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getTestUserId } from "../shidduchim/fixtures";
import {
  createServiceClient,
  seedPost,
  setShadchanApproval,
} from "./forum-fixtures";

const RUN_ID = Date.now();
const TITLE = `אזור זמן ${RUN_ID}`;
/** 22:30 UTC ב-15.1 הוא 00:30 ב-16.1 בישראל (חורף, UTC+2) */
const CREATED_AT = "2026-01-15T22:30:00Z";
const ISRAEL_TIME_ZONE = "Asia/Jerusalem";
const LOAD_TIMEOUT = 15_000;

const expectedLabel = new Date(CREATED_AT).toLocaleDateString("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ISRAEL_TIME_ZONE,
});

test.describe("פורום: שעון ישראל בתאריכים", () => {
  let service: SupabaseClient;
  let userId = "";
  let postId = "";

  test.beforeAll(async () => {
    service = createServiceClient();
    userId = await getTestUserId(service);
    await setShadchanApproval(service, userId, "approved");
    ({ postId } = await seedPost(service, {
      authorId: userId,
      title: TITLE,
      replies: [],
      likerIds: [userId],
    }));
    const { error } = await service
      .from("forum_posts")
      .update({ created_at: CREATED_AT })
      .eq("id", postId);
    expect(error).toBeNull();
  });

  test.afterAll(async () => {
    await service.from("forum_posts").delete().eq("id", postId);
    await service.from("shadchanim_info").delete().eq("user_id", userId);
  });

  test("התאריך נקבע בשעון ישראל (00:30 ב-16.1) ברשימה ובדף הפוסט", async ({
    page,
  }) => {
    // Arrange
    expect(expectedLabel).toContain("00:30");
    expect(expectedLabel).toContain("16");

    // Act
    await page.goto("/app/forums");
    const card = page.getByTestId("forum-post").filter({ hasText: TITLE });

    // Assert
    await expect(card).toContainText(expectedLabel, { timeout: LOAD_TIMEOUT });

    // Act
    await page.goto(`/app/forums/${postId}`);

    // Assert
    await expect(page.getByRole("article")).toContainText(expectedLabel, {
      timeout: LOAD_TIMEOUT,
    });
  });
});
