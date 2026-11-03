import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "./fixtures";
import { deleteCards } from "../students/third-party-card-fixtures";

/**
 * "לעיני השדכן בלבד – מידע שחשוב שידע" (partner_preferences.additional_information):
 * הצד השני בהצעה לא מקבל אותו בשום נתיב. בעל הכרטיס והשדכן כן.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
const SECRET = `סוד לשדכן ${T}`;
const ABOUT = `אופי מבוקש ${T}`;

let admin: SupabaseClient;
let groomId = "";
let brideId = "";

test.describe("מידע לעיני השדכן בלבד בכרטיס הצעה", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    const shadchanId = await getTestUserId(admin);
    const ownerId = await ensureCardManagerId(admin);
    const parentId = await ensureSecondParentId(admin);
    groomId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "מיועד",
      lastName: `שדכן${T}`,
    });
    brideId = await createCard(admin, {
      userId: parentId,
      gender: "female",
      firstName: "כלה",
      lastName: `שדכן${T}`,
    });
    const prefs = await admin.from("partner_preferences").upsert(
      {
        student_id: groomId,
        additional_information: SECRET,
        about_partner: ABOUT,
      },
      { onConflict: "student_id" },
    );
    if (prefs.error) throw new Error(prefs.error.message);
    await insertProposal(admin, { groomId, brideId, shadchanId });
  });

  test.afterAll(async () => {
    await deleteCards(admin, [groomId, brideId]);
  });

  test("הצד השני בהצעה מקבל את העדפות בן הזוג בלי המידע לשדכן", async () => {
    // Arrange
    const otherSide = await clientAs(admin, SECOND_PARENT_EMAIL);

    // Act
    const [card, direct] = await Promise.all([
      otherSide.rpc("get_proposal_student_card", { p_student_id: groomId }),
      otherSide
        .from("partner_preferences")
        .select("*")
        .eq("student_id", groomId),
    ]);

    // Assert
    expect(card.error, card.error?.message).toBeNull();
    const payload = JSON.stringify([card.data, direct.data]);
    expect(payload).toContain(ABOUT);
    expect(payload).not.toContain(SECRET);
  });

  test("השדכן ובעל הכרטיס קוראים את המידע", async () => {
    for (const email of [TEST_USER_EMAIL, CARD_MANAGER_EMAIL]) {
      // Arrange
      const client = await clientAs(admin, email);

      // Act
      const { data, error } = await client
        .from("partner_preferences")
        .select("additional_information")
        .eq("student_id", groomId);

      // Assert
      expect(error, `${email}: ${error?.message}`).toBeNull();
      expect(data).toEqual([{ additional_information: SECRET }]);
    }
  });
});
