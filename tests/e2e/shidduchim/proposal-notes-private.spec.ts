import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  ensureSecondParentId,
  insertProposal,
  openRoomAs,
  pageAs,
} from "../chats/context-fixtures";
import { deleteCards } from "../students/third-party-card-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "./fixtures";

/**
 * ההערה שהשדכן כתב לצד השני בהצעה אינה מגיעה להורה: מנהל כרטיס אינו קורא את
 * שורת shidduchim בשום נתיב, ומקבל את ההצעה רק דרך get_my_shidduch_proposals -
 * עם ההערה לצד שלו בלבד. כל הקריאות בלקוח עם JWT אמיתי של המשתמש (RLS חל).
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);
const NOTE_FOR_GROOM = `הערה-לצד-החתן-חסויה-${T}`;
const NOTE_FOR_BRIDE = `הערה-לצד-הכלה-${T}`;

type JsonRecord = Record<string, unknown>;

let admin: SupabaseClient;
let brideParent: SupabaseClient;
let groomParent: SupabaseClient;
let shadchanId: string;
let groomParentId: string;
let brideParentId: string;
let groomId = "";
let brideId = "";
let shidduchId = "";
let roomId = "";

test.describe("ההערה לצד השני בהצעה (מסד)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    groomParentId = await ensureCardManagerId(admin);
    brideParentId = await ensureSecondParentId(admin);
    groomId = await createCard(admin, {
      userId: groomParentId,
      gender: "male",
      firstName: "חתן",
      lastName: `הערות${T}`,
    });
    brideId = await createCard(admin, {
      userId: brideParentId,
      gender: "female",
      firstName: "כלה",
      lastName: `הערות${T}`,
    });
    shidduchId = await insertProposal(admin, {
      groomId,
      brideId,
      shadchanId,
      scope: "both",
    });
    const { error } = await admin
      .from("shidduchim")
      .update({
        note_for_groom: NOTE_FOR_GROOM,
        note_for_bride: NOTE_FOR_BRIDE,
      })
      .eq("id", shidduchId);
    if (error) throw new Error(error.message);

    brideParent = await clientAs(admin, SECOND_PARENT_EMAIL);
    groomParent = await clientAs(admin, CARD_MANAGER_EMAIL);
  });

  test.afterAll(async () => {
    await admin.from("chat_rooms").delete().eq("shidduch_id", shidduchId);
    await deleteCards(admin, [groomId, brideId].filter(Boolean));
  });

  test("הורה הכלה אינו קורא את שורת ההצעה: לא כל עמודה, לא '*' ולא דרך embed", async () => {
    // Arrange: שרשור צ'אט על ההצעה, כדי שיהיה ממנו embed
    const matchmaker = await clientAs(admin, TEST_USER_EMAIL);
    const room = await openRoomAs(matchmaker, brideParentId, {
      kind: "shidduch",
      shidduchId,
    });
    expect(room.error).toBeNull();
    roomId = room.roomId ?? "";

    // Act
    const star = await brideParent
      .from("shidduchim")
      .select("*")
      .eq("id", shidduchId);
    const columns = await brideParent
      .from("shidduchim")
      .select(
        "id, note_for_groom, note_for_bride, share_cv, share_contact_details, share_medical_info, share_groom_photo, shadchan_id, status",
      )
      .eq("id", shidduchId);
    const byNote = await brideParent
      .from("shidduchim")
      .select("id")
      .ilike("note_for_groom", `%${T}%`);
    const viaRooms = await brideParent
      .from("chat_rooms")
      .select("*, shidduchim(*)")
      .eq("shidduch_id", shidduchId);
    const viaResponses = await brideParent
      .from("shidduch_responses")
      .select("*, shidduchim(*)")
      .eq("shidduch_id", shidduchId);

    // Assert
    for (const result of [star, columns, byNote]) {
      expect(result.error, result.error?.message).toBeNull();
      expect(result.data).toEqual([]);
    }
    for (const result of [viaRooms, viaResponses]) {
      expect(JSON.stringify(result.data ?? [])).not.toContain(NOTE_FOR_GROOM);
      for (const row of (result.data ?? []) as JsonRecord[]) {
        expect(row.shidduchim ?? null).toBeNull();
      }
    }
    expect((viaRooms.data ?? []).length).toBe(1);
  });

  test("הורה הכלה מקבל את ההצעה דרך הפונקציה: ההערה שלו בלבד, וכל זרימות ההורה עובדות", async () => {
    // Act
    const proposals = await brideParent.rpc("get_my_shidduch_proposals", {
      p_shidduch_id: shidduchId,
    });
    const card = await brideParent.rpc("get_proposal_student_card", {
      p_student_id: groomId,
    });
    const respond = await brideParent.rpc("respond_to_shidduch", {
      p_shidduch_id: shidduchId,
      p_side: "bride",
      p_response: "interested",
      p_message: "נשמח לשמוע עוד",
    });
    const responses = await brideParent
      .from("shidduch_responses")
      .select("side, response")
      .eq("shidduch_id", shidduchId);
    const notifications = await brideParent
      .from("notifications")
      .select("title, body, link")
      .eq("related_id", shidduchId);
    const access = await brideParent.rpc("get_student_card_access", {
      sid: groomId,
    });

    // Assert
    expect(proposals.error, proposals.error?.message).toBeNull();
    const rows = (proposals.data ?? []) as JsonRecord[];
    expect(rows).toHaveLength(1);
    expect(rows[0].side).toBe("bride");
    expect(rows[0].note).toBe(NOTE_FOR_BRIDE);
    expect(rows[0].other_student_id).toBe(groomId);
    expect(card.error, card.error?.message).toBeNull();
    expect(respond.error, respond.error?.message).toBeNull();
    expect(responses.data).toEqual([{ side: "bride", response: "interested" }]);
    expect(access.data?.[0]?.access_level).toBe("proposal");
    for (const payload of [
      proposals.data,
      card.data,
      respond.data,
      responses.data,
      notifications.data,
    ]) {
      expect(JSON.stringify(payload ?? null)).not.toContain(NOTE_FOR_GROOM);
    }
  });

  test("שרשור הצ'אט על ההצעה: ההורה רואה קישור להצעה ולשני הכרטיסים", async ({
    browser,
  }) => {
    // Arrange
    const parent = await pageAs(
      browser,
      admin,
      SECOND_PARENT_EMAIL,
      `/app/chats/${roomId}`,
    );

    // Assert
    const bar = parent.getByTestId("room-context-bar");
    await expect(bar.getByRole("link", { name: "להצעה" })).toHaveAttribute(
      "href",
      `/app/shidduchim/${shidduchId}`,
      { timeout: 20_000 },
    );
    await expect(
      bar.getByRole("link", { name: new RegExp(`לכרטיס של חתן`) }),
    ).toHaveAttribute("href", `/app/students/${groomId}`);
    await expect(
      bar.getByRole("link", { name: new RegExp(`לכרטיס של כלה`) }),
    ).toHaveAttribute("href", `/app/students/${brideId}`);
    await expect(bar).not.toContainText("ההצעה הוסרה מהמערכת");
    expect(await parent.content()).not.toContain(NOTE_FOR_GROOM);
    await parent.context().close();
  });

  test("הורה החתן: ההערה שלו בלבד, ולא ההערה לצד הכלה", async () => {
    // Act
    const proposals = await groomParent.rpc("get_my_shidduch_proposals", {
      p_shidduch_id: shidduchId,
    });
    const direct = await groomParent
      .from("shidduchim")
      .select("note_for_bride")
      .eq("id", shidduchId);

    // Assert
    const rows = (proposals.data ?? []) as JsonRecord[];
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe(NOTE_FOR_GROOM);
    expect(JSON.stringify(proposals.data)).not.toContain(NOTE_FOR_BRIDE);
    expect(direct.data).toEqual([]);
  });

  test("השדכן של ההצעה ומנהל קוראים את שתי ההערות כמו תמיד", async () => {
    for (const email of [TEST_USER_EMAIL, ADMIN_EMAIL]) {
      // Arrange
      const client = await clientAs(admin, email);

      // Act
      const { data, error } = await client
        .from("shidduchim")
        .select("note_for_groom, note_for_bride")
        .eq("id", shidduchId)
        .single();

      // Assert
      expect(error, `${email}: ${error?.message}`).toBeNull();
      expect(data).toEqual({
        note_for_groom: NOTE_FOR_GROOM,
        note_for_bride: NOTE_FOR_BRIDE,
      });
    }
  });
});
