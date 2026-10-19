/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן מאושר).
 * Data: get_forum_author_names (is_admin) ← features/forums/lib/queries.ts loadAuthorNames.
 * User: "בהערות שאני רושם כשדכן ובפורום, יופיע מנהל מערכת".
 *
 * כותב שהוא מנהל (לפי התפקיד הנוכחי, גם כשהוא גם שדכן) מוצג "מנהל מערכת"
 * בלבד - בלי שמו - ברשימת הנושאים, בעמוד הנושא ובתגובות. שדכן רגיל לא השתנה.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getTestUserId } from "../shidduchim/fixtures";
import {
  createApprovedMatchmaker,
  createServiceClient,
  seedPost,
  setShadchanApproval,
  type OtherMatchmaker,
} from "./forum-fixtures";

const RUN_ID = Date.now();
const TITLE = `כותב מנהל ${RUN_ID}`;
const ADMIN_LABEL = "מנהל מערכת";
const ADMIN_REPLY = `תגובת מנהל ${RUN_ID}`;
const REGULAR_REPLY = `תגובת שדכן ${RUN_ID}`;
/** השמות ש-createApprovedMatchmaker נותנת */
const nameOf = (runId: number) => `כותב פורום${runId}`;

test.describe("כותב מנהל בפורום", () => {
  test.describe.configure({ mode: "serial" });

  let service: SupabaseClient;
  let userId = "";
  let adminAuthor: OtherMatchmaker;
  let regularAuthor: OtherMatchmaker;
  let postId = "";

  test.beforeAll(async () => {
    service = createServiceClient();
    userId = await getTestUserId(service);
    await setShadchanApproval(service, userId, "approved");
    adminAuthor = await createApprovedMatchmaker(service, RUN_ID);
    regularAuthor = await createApprovedMatchmaker(service, RUN_ID + 1);
    // שדכן שהוא גם מנהל - כמו הלקוח
    const { error } = await service.auth.admin.updateUserById(adminAuthor.id, {
      app_metadata: { roles: ["shadchan", "admin"] },
    });
    expect(error).toBeNull();
    ({ postId } = await seedPost(service, {
      authorId: adminAuthor.id,
      title: TITLE,
      replies: [
        { authorId: adminAuthor.id, content: ADMIN_REPLY },
        { authorId: regularAuthor.id, content: REGULAR_REPLY },
      ],
      likerIds: [regularAuthor.id],
    }));
  });

  test.afterAll(async () => {
    await service.from("forum_posts").delete().eq("title", TITLE);
    await service.auth.admin.deleteUser(adminAuthor.id);
    await service.auth.admin.deleteUser(regularAuthor.id);
    await service.from("shadchanim_info").delete().eq("user_id", userId);
  });

  test("ברשימת הנושאים הכותב מוצג 'מנהל מערכת' בלי שמו", async ({ page }) => {
    // Act
    await page.goto("/app/forums");

    // Assert
    const card = page.getByTestId("forum-post").filter({ hasText: TITLE });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(`${ADMIN_LABEL} ·`);
    await expect(card).not.toContainText(nameOf(RUN_ID));
  });

  test("בעמוד הנושא: הפוסט ותגובת המנהל 'מנהל מערכת', תגובת שדכן עם שמו", async ({
    page,
  }) => {
    // Act
    await page.goto(`/app/forums/${postId}`);

    // Assert - הפוסט
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({
      timeout: 15_000,
    });
    const postArticle = page.locator("article").first();
    await expect(postArticle).toContainText(`${ADMIN_LABEL} ·`);
    await expect(page.getByText(nameOf(RUN_ID))).toHaveCount(0);

    // Assert - התגובות
    const replies = page.getByTestId("forum-reply");
    await expect(replies.filter({ hasText: ADMIN_REPLY })).toContainText(
      `${ADMIN_LABEL} ·`,
    );
    const regular = replies.filter({ hasText: REGULAR_REPLY });
    await expect(regular).toContainText(`${nameOf(RUN_ID + 1)} ·`);
    await expect(regular).not.toContainText(ADMIN_LABEL);
  });
});
