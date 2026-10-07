import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  createCard,
  deleteRoomsAmong,
  ensureSecondParentId,
  pageAs,
} from "../chats/context-fixtures";
import {
  SEEDED,
  deleteCards,
  grandfatherCard,
  seedFullCard,
} from "../students/third-party-card-fixtures";
import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * כרטיס השידוך לשדכן: סיכום פרטי שני המועמדים (גיל, מגורים, הורים, קישור
 * לכרטיס המלא), וההערה שנשלחה לכל צד כהודעת הפתיחה של השיחה מולו.
 */
const GROOM_NOTE = "הערה-לצד-החתן-7301";
const BRIDE_NOTE = "הערה-לצד-הכלה-7302";
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";

test.describe("כרטיס שידוך: סיכום מועמדים והערות בשרשור", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let parentB: string;
  let brideCard: string;
  let thirdPartyGroom: string;
  let proposalId: string;
  let thirdPartyProposalId: string;

  const insertSent = async (groomId: string, notes: boolean) => {
    const { data, error } = await admin
      .from("shidduchim")
      .insert({
        groom_id: groomId,
        bride_id: brideCard,
        shadchan_id: shadchanId,
        status: "sent",
        recipient_scope: "both",
        sent_at: new Date().toISOString(),
        note_for_groom: notes ? GROOM_NOTE : null,
        note_for_bride: notes ? BRIDE_NOTE : null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`יצירת הצעה נכשלה: ${error?.message}`);
    return data.id as string;
  };

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    parentB = await ensureSecondParentId(admin);
    brideCard = await createCard(admin, {
      userId: parentB,
      gender: "female",
      firstName: "כלה",
      lastName: "לסיכום",
    });
    thirdPartyGroom = await seedFullCard(admin, {
      ownerId: fx.cardManagerId,
      lastName: "צדשלישי",
      gender: "male",
      firstName: "חתן",
    });
    // אישור קבלת הצעות בלבד (שליחה חסומה בלעדיו); הצגה מלאה נשארת ממתינה
    await admin
      .from("students")
      .update({ third_party_proposals_approved_at: new Date().toISOString() })
      .eq("id", thirdPartyGroom);
    await deleteRoomsAmong(admin, [shadchanId, fx.cardManagerId, parentB]);
    proposalId = await insertSent(fx.groomFirst, true);
    thirdPartyProposalId = await insertSent(thirdPartyGroom, false);
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, [shadchanId, fx.cardManagerId, parentB]);
    await admin
      .from("shidduchim")
      .delete()
      .in("id", [proposalId, thirdPartyProposalId]);
    await deleteCards(admin, [thirdPartyGroom, brideCard]);
    await teardownShidduchFixtures(admin, fx);
  });

  test("הסיכום מציג גיל, מגורים ושם, ומקשר לכרטיס המלא", async ({ page }) => {
    await page.goto(`/app/shidduchim/${proposalId}`);

    const groom = page.getByTestId("candidate-summary").first();
    await expect(groom).toContainText("מיועד ראשון");
    await expect(groom).toContainText("גיל:");
    await expect(groom).toContainText("בני ברק");
    await expect(groom).toContainText("רווק");
    await expect(
      groom.getByRole("link", { name: "לכרטיס המלא" }),
    ).toHaveAttribute("href", `/app/students/${fx.groomFirst}`);
    // אין פרטי הורים בכרטיס הזה: השורה מושמטת ולא מודפס שום מציין מקום
    await expect(groom).not.toContainText("הורים");
  });

  test("הערה לכל צד מופיעה בשרשור של אותו צד בלבד, ולא בגוש נפרד", async ({
    page,
  }) => {
    await page.goto(`/app/shidduchim/${proposalId}`);

    const groomPanel = page.getByRole("region", {
      name: "שיחה על ההצעה - עם צד החתן",
    });
    const bridePanel = page.getByRole("region", {
      name: "שיחה על ההצעה - עם צד הכלה",
    });
    await expect(groomPanel.getByTestId("proposal-opening-note")).toContainText(
      GROOM_NOTE,
    );
    await expect(groomPanel).not.toContainText(BRIDE_NOTE);
    await expect(bridePanel.getByTestId("proposal-opening-note")).toContainText(
      BRIDE_NOTE,
    );
    await expect(bridePanel).not.toContainText(GROOM_NOTE);
    await expect(page.getByText(GROOM_NOTE)).toHaveCount(1);
    await expect(page.getByText(BRIDE_NOTE)).toHaveCount(1);
    await expect(page.getByText("הערות לצד המיועד")).toHaveCount(0);

    // תצוגה בלבד: לא נוצרו חדרים או הודעות
    const { data: rooms } = await admin
      .from("chat_rooms")
      .select("room_id")
      .eq("shidduch_id", proposalId);
    expect(rooms).toHaveLength(0);
  });

  test("להורה: ההערה של הצד שלו בלבד, בתוך השרשור מול השדכן", async ({
    browser,
  }) => {
    const bridePage = await pageAs(
      browser,
      admin,
      SECOND_PARENT_EMAIL,
      `/app/shidduchim/${proposalId}`,
    );
    const panel = bridePage.getByRole("region", {
      name: "שיחה על ההצעה - עם השדכן",
    });
    await expect(panel.getByTestId("proposal-opening-note")).toContainText(
      BRIDE_NOTE,
    );
    await expect(bridePage.getByText(GROOM_NOTE)).toHaveCount(0);
    await expect(bridePage.getByText(BRIDE_NOTE)).toHaveCount(1);
    await bridePage.context().close();

    const groomPage = await pageAs(
      browser,
      admin,
      CARD_MANAGER_EMAIL,
      `/app/shidduchim/${proposalId}`,
    );
    await expect(
      groomPage
        .getByRole("region", { name: "שיחה על ההצעה - עם השדכן" })
        .getByTestId("proposal-opening-note"),
    ).toContainText(GROOM_NOTE);
    await expect(groomPage.getByText(BRIDE_NOTE)).toHaveCount(0);
    await groomPage.context().close();
  });

  test("כרטיס צד שלישי מוגבל: רק הנתונים הבסיסיים, בלי ז״ל ובלי פרטים רגישים", async ({
    page,
  }) => {
    await admin
      .from("students")
      .update({
        parents_info: {
          status: "widowed",
          deadParent: "father",
          father: { self: { name: SEEDED.fatherName }, job: SEEDED.fatherJob },
          mother: { self: { name: "שרה-שם-אם" }, job: SEEDED.motherJob },
        },
      })
      .eq("id", thirdPartyGroom);

    await page.goto(`/app/shidduchim/${thirdPartyProposalId}`);

    const groom = page.getByTestId("candidate-summary").first();
    await expect(groom).toContainText(SEEDED.city);
    await expect(groom).toContainText("בעלזא");
    await expect(groom).toContainText(SEEDED.fatherName);
    await expect(groom).toContainText("שרה-שם-אם");
    await expect(groom).not.toContainText("ז״ל");
    const body = page.locator("body");
    for (const hidden of [
      SEEDED.about,
      SEEDED.fatherJob,
      SEEDED.motherJob,
      SEEDED.familyAbout,
      SEEDED.referenceName,
      "0501119999",
    ]) {
      await expect(body).not.toContainText(hidden);
    }
  });

  test("אחרי אישור הצגה מלאה מוסיפים ז״ל להורה שנפטר", async ({ page }) => {
    await grandfatherCard(admin, thirdPartyGroom);

    await page.goto(`/app/shidduchim/${thirdPartyProposalId}`);

    await expect(page.getByTestId("candidate-summary").first()).toContainText(
      `${SEEDED.fatherName} ז״ל`,
    );
    // גם בכרטיס מאושר הסיכום אינו חושף עיסוק או טלפון
    await expect(page.locator("body")).not.toContainText(SEEDED.fatherJob);
  });
});
