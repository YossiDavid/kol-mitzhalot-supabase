import { expect, test } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * create_notification מקבלת רק נתיב פנימי יחיד. דפדפן מסיר טאב ושורה חדשה
 * מכתובת, ולכן "/<TAB>/evil.com" היה הופך ל-//evil.com.
 */
const TITLE = `בדיקת קישור ${Date.now()}`;

test.describe("create_notification - אימות קישור", () => {
  const admin = createServiceClient();
  let userId: string;

  test.beforeAll(async () => {
    userId = await getTestUserId(admin);
  });

  test.afterAll(async () => {
    await admin.from("notifications").delete().eq("title", TITLE);
  });

  const create = (link: string | null) =>
    admin.rpc("create_notification", {
      p_user_id: userId,
      p_type: "chat_message",
      p_title: TITLE,
      p_body: null,
      p_link: link,
    });

  const storedLinks = async () => {
    const { data } = await admin
      .from("notifications")
      .select("link")
      .eq("title", TITLE);
    return (data ?? []).map((row) => row.link as string | null);
  };

  test("קישורים מסוכנים נדחים בשקט", async () => {
    // Act
    for (const link of [
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "/ /evil.com",
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
    ]) {
      const { error } = await create(link);
      expect(error).toBeNull();
    }

    // Assert
    expect(await storedLinks()).toHaveLength(0);
  });

  test("נתיבים פנימיים תקינים נשמרים", async () => {
    // Act
    await create("/app/shidduchim/abc?x=1#y");
    await create("/");
    await create(null);

    // Assert
    expect((await storedLinks()).sort()).toEqual(
      [null, "/", "/app/shidduchim/abc?x=1#y"].sort(),
    );
  });
});
