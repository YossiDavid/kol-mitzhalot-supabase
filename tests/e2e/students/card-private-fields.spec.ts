import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
} from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * "מדוע מילאתי" נשמר ב-student_private, ששדכן אינו קורא; סיבת דחייה קיימת
 * רק בכרטיס שנדחה, שאינו מאושר ולכן חסום לשדכן
 * (20261108160000_card_private_fields.sql).
 */
const T = `${Date.now()}`.slice(-8);
const REASON = `הסבר-פרטי-${T}`;
const AUTHOR = { name: "ממלא", relation: "שכן", fillReason: REASON };

let admin: SupabaseClient;
let cardId = "";

async function storedReason(): Promise<string | null> {
  const { data } = await admin
    .from("student_private")
    .select("fill_reason")
    .eq("student_id", cardId)
    .maybeSingle();
  return data?.fill_reason ?? null;
}

test.describe("שדות פרטיים של כרטיס", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    const ownerId = await ensureCardManagerId(admin);
    cardId = await createCard(admin, {
      userId: ownerId,
      gender: "male",
      firstName: "פרטי",
      lastName: `שדות${T}`,
    });
    const { error } = await admin
      .from("students")
      .update({ author_info: AUTHOR })
      .eq("id", cardId);
    if (error) throw new Error(error.message);
  });

  test.afterAll(async () => {
    await deleteCards(admin, [cardId]);
  });

  test("ההסבר יוצא מ-author_info ונשמר בטבלה הפרטית", async () => {
    // Act
    const { data } = await admin
      .from("students")
      .select("author_info")
      .eq("id", cardId)
      .single();

    // Assert
    expect(data?.author_info).toEqual({ name: "ממלא", relation: "שכן" });
    expect(await storedReason()).toBe(REASON);
  });

  test("שדכן אינו קורא את ההסבר, גם לא ישירות מהמסד", async () => {
    // Arrange
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);

    // Act
    const card = await shadchan
      .from("students")
      .select("author_info")
      .eq("id", cardId)
      .single();
    const privateRow = await shadchan
      .from("student_private")
      .select("fill_reason")
      .eq("student_id", cardId);

    // Assert
    expect(card.error).toBeNull();
    expect(JSON.stringify(card.data)).not.toContain(REASON);
    expect(privateRow.data ?? []).toEqual([]);
  });

  test("בעל הכרטיס קורא את ההסבר ומעדכן אותו", async () => {
    // Arrange
    const owner = await clientAs(admin, CARD_MANAGER_EMAIL);

    // Act
    const read = await owner
      .from("student_private")
      .select("fill_reason")
      .eq("student_id", cardId)
      .single();
    const update = await owner
      .from("students")
      .update({ author_info: { ...AUTHOR, fillReason: `${REASON}-חדש` } })
      .eq("id", cardId);

    // Assert
    expect(read.data?.fill_reason).toBe(REASON);
    expect(update.error).toBeNull();
    expect(await storedReason()).toBe(`${REASON}-חדש`);
  });

  test("עריכה של שדכן אינה דורסת את ההסבר", async () => {
    // Arrange
    const before = await storedReason();
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);

    // Act: שדכן אינו רואה את ההסבר, ולכן הטופס שלו שולח אותו ריק
    await shadchan
      .from("students")
      .update({ author_info: { ...AUTHOR, fillReason: "" } })
      .eq("id", cardId);

    // Assert
    expect(await storedReason()).toBe(before);
  });

  test("סיבת דחייה אינה נשמרת בכרטיס מאושר", async () => {
    // Act
    const { error } = await admin
      .from("students")
      .update({ admin_rejection_reason: "סיבה" })
      .eq("id", cardId);

    // Assert
    expect(error?.message).toContain("students_admin_approval_state_check");
  });
});
