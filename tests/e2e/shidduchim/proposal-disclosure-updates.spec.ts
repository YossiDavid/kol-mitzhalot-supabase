import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
  pageAs,
} from "../chats/context-fixtures";
import { createApprovedMatchmaker } from "../forums/forum-fixtures";
import { deleteCards } from "../students/third-party-card-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "./fixtures";
import { buildDisclosureOpenedEmail } from "../../../lib/email/templates/proposal-disclosure-opened";

/**
 * פתיחת מידע נוסף בהצעה אחרי השליחה (set_proposal_disclosure), וספירת ההצעות
 * שהוצעו לכרטיס (get_card_proposal_count / get_my_card_proposals). קריאות המסד
 * בלקוח עם JWT אמיתי של המשתמש (RLS חל); בדיקות הדפים דרך הדפדפן.
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
const LAST = `פתיחה${T}`;
const REF_PHONE = `057${T}7`;
const LOAD_TIMEOUT = 20_000;
const CLOSED = {
  p_share_cv: false,
  p_share_references: false,
  p_share_medical: false,
  p_share_groom_photo: true,
};

let admin: SupabaseClient;
let matchmaker: SupabaseClient;
let shadchanId: string;
let groomParentId: string;
let brideParentId: string;
let groomId = "";
let brideId = "";
let groomOnlyGroomId = "";
let draftGroomId = "";
let sentId = "";
let groomOnlyId = "";
let draftId = "";

async function notificationsFor(userId: string, shidduchId: string) {
  const { data, error } = await admin
    .from("notifications")
    .select("id, body, link, read_at")
    .eq("user_id", userId)
    .eq("type", "proposal_disclosure_opened")
    .eq("related_id", shidduchId);
  expect(error, error?.message).toBeNull();
  return data ?? [];
}

test.describe("פתיחת מידע בהצעה וספירת הצעות (מסד ודפים)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    groomParentId = await ensureCardManagerId(admin);
    brideParentId = await ensureSecondParentId(admin);
    const card = (userId: string, gender: "male" | "female", first: string) =>
      createCard(admin, { userId, gender, firstName: first, lastName: LAST });
    groomId = await card(groomParentId, "male", "חתן");
    brideId = await card(brideParentId, "female", "כלה");
    groomOnlyGroomId = await card(groomParentId, "male", "חתן-צד-אחד");
    draftGroomId = await card(groomParentId, "male", "חתן-טיוטה");

    const ref = await admin.from("references").insert({
      student_id: groomId,
      reference_type: "friend",
      name: `ממליץ-${T}`,
      phone: REF_PHONE,
    });
    if (ref.error) throw new Error(ref.error.message);

    sentId = await insertProposal(admin, { groomId, brideId, shadchanId });
    groomOnlyId = await insertProposal(admin, {
      groomId: groomOnlyGroomId,
      brideId,
      shadchanId,
      scope: "groom_only",
    });
    draftId = await insertProposal(admin, {
      groomId: draftGroomId,
      brideId,
      shadchanId,
      status: "draft",
    });
    matchmaker = await clientAs(admin, TEST_USER_EMAIL);
  });

  test.afterAll(async () => {
    await deleteCards(admin, [
      groomId,
      brideId,
      groomOnlyGroomId,
      draftGroomId,
    ]);
  });

  test("רק השדכן של ההצעה ומנהל משנים: שדכן אחר, הורה וגולש נדחים, וגם עדכון ישיר של הורה", async () => {
    // Arrange
    const other = await createApprovedMatchmaker(admin, Number(T));
    const otherMatchmaker = await clientAs(admin, other.email);
    const parent = await clientAs(admin, SECOND_PARENT_EMAIL);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const open = { ...CLOSED, p_shidduch_id: sentId, p_share_cv: true };

    // Act
    const byOther = await otherMatchmaker.rpc("set_proposal_disclosure", open);
    const byParent = await parent.rpc("set_proposal_disclosure", open);
    const byAnon = await anon.rpc("set_proposal_disclosure", open);
    const direct = await parent
      .from("shidduchim")
      .update({ share_cv: true, share_references: true })
      .eq("id", sentId)
      .select("id");
    const { data: row } = await admin
      .from("shidduchim")
      .select("share_cv, share_references")
      .eq("id", sentId)
      .single();

    // Assert
    expect(byOther.error?.message).toBe("not_allowed");
    expect(byParent.error?.message).toBe("not_allowed");
    expect(byAnon.error).not.toBeNull();
    expect(direct.data ?? []).toEqual([]);
    expect(row).toEqual({ share_cv: false, share_references: false });
    expect(await notificationsFor(brideParentId, sentId)).toEqual([]);
  });

  test("פתיחה בהצעה שנשלחה: התראה אחת לכל צד; פתיחה נוספת בתוך שעה מתמזגת; סגירה בשקט", async () => {
    // Act: שני פריטים בשמירה אחת
    const first = await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: sentId,
      p_share_cv: true,
      p_share_references: true,
    });
    const afterFirst = {
      groom: await notificationsFor(groomParentId, sentId),
      bride: await notificationsFor(brideParentId, sentId),
    };
    // סגירה: בשקט
    const close = await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: sentId,
      p_share_cv: true,
    });
    // פתיחה נוספת בתוך השעה (הרפואי): מתמזגת, בלי התראה חדשה
    const second = await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: sentId,
      p_share_cv: true,
      p_share_medical: true,
    });
    const afterSecond = await notificationsFor(brideParentId, sentId);

    // Assert
    expect(first.error, first.error?.message).toBeNull();
    expect((first.data as { notified: unknown[] }).notified).toHaveLength(2);
    expect(afterFirst.groom).toHaveLength(1);
    expect(afterFirst.bride).toHaveLength(1);
    expect(afterFirst.bride[0].body).toContain('קובץ קו"ח');
    expect(afterFirst.bride[0].body).toContain("פרטי הממליצים");
    expect(afterFirst.bride[0].link).toBe(`/app/students/${groomId}`);
    expect(afterFirst.groom[0].link).toBe(`/app/students/${brideId}`);
    expect(close.error).toBeNull();
    expect((close.data as { notified: unknown[] }).notified).toEqual([]);
    expect(second.error).toBeNull();
    expect((second.data as { notified: unknown[] }).notified).toEqual([]);
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0].body).toContain("הצהרה רפואית");
    expect(afterSecond[0].body).toContain('קובץ קו"ח');
  });

  test("נשלחה לצד אחד: רק הוא מקבל התראה; תמונת הבחור - רק לצד הכלה; טיוטה - בלי התראות", async () => {
    // Act
    await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: groomOnlyId,
      p_share_groom_photo: false,
    });
    const groomOnly = await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: groomOnlyId,
      p_share_cv: true,
      p_share_groom_photo: true,
    });
    const draft = await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: draftId,
      p_share_cv: true,
      p_share_references: true,
    });

    // Assert
    const groomSide = await notificationsFor(groomParentId, groomOnlyId);
    expect(groomSide).toHaveLength(1);
    expect(groomSide[0].body).toContain('קובץ קו"ח');
    expect(groomSide[0].body).not.toContain("תמונת הבחור");
    expect(await notificationsFor(brideParentId, groomOnlyId)).toEqual([]);
    expect(groomOnly.error).toBeNull();
    expect(draft.error).toBeNull();
    expect((draft.data as { notified: unknown[] }).notified).toEqual([]);
    const { data: draftRow } = await admin
      .from("shidduchim")
      .select("share_cv, share_references")
      .eq("id", draftId)
      .single();
    expect(draftRow).toEqual({ share_cv: true, share_references: true });
  });

  test("ההורה של הצד השני רואה את טלפון הממליץ רק אחרי שהשדכן שיתף", async () => {
    // Arrange
    const parent = await clientAs(admin, SECOND_PARENT_EMAIL);
    await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: sentId,
    });
    const closed = await parent.rpc("get_proposal_student_card", {
      p_student_id: groomId,
    });

    // Act
    await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: sentId,
      p_share_references: true,
    });
    const opened = await parent.rpc("get_proposal_student_card", {
      p_student_id: groomId,
    });

    // Assert
    expect(JSON.stringify(closed.data)).not.toContain(REF_PHONE);
    expect(JSON.stringify(opened.data)).toContain(REF_PHONE);
  });

  test("ספירת ההצעות: שדכן, בעל הכרטיס ומנהל - כן; הצד השני, הורה זר וגולש - לא", async () => {
    // Arrange
    const owner = await clientAs(admin, CARD_MANAGER_EMAIL);
    const adminUser = await clientAs(admin, ADMIN_EMAIL);
    const proposalViewer = await clientAs(admin, SECOND_PARENT_EMAIL);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { count: expected } = await admin
      .from("shidduch_events")
      .select("id", { count: "exact", head: true })
      .eq("student_id", groomId);
    const other = await createApprovedMatchmaker(admin, Number(T) + 1);
    const otherMatchmaker = await clientAs(admin, other.email);

    // Act
    const counts = await Promise.all(
      [matchmaker, owner, adminUser, proposalViewer, anon].map((client) =>
        client.rpc("get_card_proposal_count", { p_student_id: groomId }),
      ),
    );
    const mine = await matchmaker.rpc("get_my_card_proposals", {
      p_student_id: groomId,
    });
    const notMine = await otherMatchmaker.rpc("get_my_card_proposals", {
      p_student_id: groomId,
    });
    const viewerList = await proposalViewer.rpc("get_my_card_proposals", {
      p_student_id: groomId,
    });

    // Assert
    expect(expected).toBe(1);
    expect(counts[0].data).toBe(1);
    expect(counts[1].data).toBe(1);
    expect(counts[2].data).toBe(1);
    expect(counts[3].data).toBeNull();
    expect(counts[4].data ?? null).toBeNull();
    expect(mine.data).toEqual([
      expect.objectContaining({ shidduch_id: sentId, status: "sent" }),
    ]);
    expect(notMine.data).toEqual([]);
    expect(viewerList.data).toEqual([]);
  });

  test("דף ההצעה: 'מה הצדדים רואים' עם אישור, והכרטיס אצל הצד השני משתקף אחרי רענון", async ({
    page,
    browser,
  }) => {
    // Arrange
    await matchmaker.rpc("set_proposal_disclosure", {
      ...CLOSED,
      p_shidduch_id: sentId,
    });
    await page.goto(`/app/shidduchim/${sentId}`);
    const section = page.getByTestId("proposal-disclosure-controls");
    await expect(section).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(section).not.toContainText("טלפון של המיועד");

    // Act
    await section.getByRole("checkbox", { name: "פרטי הממליצים" }).click();
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog).toContainText("פרטי הממליצים");
    await dialog.getByRole("button", { name: "פתיחה" }).click();

    // Assert
    await expect(
      section.getByRole("checkbox", { name: "פרטי הממליצים" }),
    ).toBeChecked({ timeout: LOAD_TIMEOUT });
    const parent = await pageAs(
      browser,
      admin,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );
    await expect(parent.getByRole("link", { name: REF_PHONE })).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await parent.context().close();
  });

  test("הכרטיס: המספר והרשימה לפי תפקיד", async ({ page, browser }) => {
    // שדכן: המספר וההצעות שלו
    await page.goto(`/app/students/${groomId}`);
    const section = page.getByTestId("card-proposals");
    await expect(section).toHaveAttribute("data-scope", "shadchan", {
      timeout: LOAD_TIMEOUT,
    });
    await expect(section.getByTestId("card-proposals-total")).toHaveText("1");
    await expect(section.getByRole("link", { name: "להצעה" })).toHaveAttribute(
      "href",
      `/app/shidduchim/${sentId}`,
    );

    // בעל הכרטיס: המספר בלבד
    const owner = await pageAs(
      browser,
      admin,
      CARD_MANAGER_EMAIL,
      `/app/students/${groomId}`,
    );
    const ownerSection = owner.getByTestId("card-proposals");
    await expect(ownerSection).toHaveAttribute("data-scope", "owner", {
      timeout: LOAD_TIMEOUT,
    });
    await expect(ownerSection.getByTestId("card-proposals-list")).toHaveCount(
      0,
    );
    await owner.context().close();

    // הצד השני בהצעה: כלום
    const parent = await pageAs(
      browser,
      admin,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );
    await expect(
      parent.getByRole("heading", { level: 1, name: new RegExp(LAST) }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(parent.getByTestId("card-proposals")).toHaveCount(0);
    await parent.context().close();

    // מנהל: כל ההצעות, עם שם השדכן וקישור לדוח
    const adminPage = await pageAs(
      browser,
      admin,
      ADMIN_EMAIL,
      `/app/students/${groomId}`,
    );
    const adminSection = adminPage.getByTestId("card-proposals");
    await expect(adminSection).toHaveAttribute("data-scope", "admin", {
      timeout: LOAD_TIMEOUT,
    });
    await expect(adminSection).toContainText("שדכן:");
    await expect(
      adminSection.getByRole("link", { name: "לכל ההצעות בדוח ההצעות" }),
    ).toBeVisible();
    await adminPage.context().close();
  });

  test("חלון השליחה כולל 'לשתף את פרטי הממליצים', סגור כברירת מחדל", async ({
    page,
  }) => {
    await page.goto("/app/shadchan/drafts");
    await page.getByRole("button", { name: "עריכה ושליחה" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("checkbox", { name: "לשתף את פרטי הממליצים" }),
    ).not.toBeChecked({ timeout: LOAD_TIMEOUT });
    await expect(dialog.locator("#share-references-hint")).toContainText(
      "פרטי הקשר של המיועד/ת ושל ההורים אינם נחשפים",
    );
  });

  test("מייל הפתיחה: הפריטים והקישור, בבריחה", () => {
    const injection = `<script>alert("x")</script>`;
    const content = buildDisclosureOpenedEmail({
      ownerFirstName: injection,
      items: ['קובץ קו"ח', "פרטי הממליצים"],
      otherStudentId: "11111111-2222-4333-8444-555555555555",
    });
    expect(content.text).toContain("פרטי הממליצים");
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).toContain(
      "/app/students/11111111-2222-4333-8444-555555555555",
    );
  });
});
