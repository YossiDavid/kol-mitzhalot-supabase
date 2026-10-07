import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Browser, Page } from "@playwright/test";

/**
 * עוזרים לבדיקות שרשורי הקשר בצ'אט. כמו fixtures של השידוכים, הם מקימים
 * לעצמם משתמשים וכרטיסים ואינם נשענים על seed.sql.
 */

/** אימייל "מנהל הכרטיסים" של fixtures.ts (CARD_MANAGER) */
export const CARD_MANAGER_EMAIL = "playwright-card-manager@kol-mitzhalot.test";

const SECOND_PARENT = {
  email: "playwright-second-parent@kol-mitzhalot.test",
  firstName: "Second",
  lastName: "Parent",
  phone: "+972500000021",
};

export type ContextRoomRow = {
  room_id: string;
  context_kind: string;
  student_id: string | null;
  shidduch_id: string | null;
  context_label: string | null;
};

/** הורה שני: מנהל כרטיס של הצד השני בהצעה. נוצר פעם אחת ונשאר לשימוש חוזר. */
export async function ensureSecondParentId(
  admin: SupabaseClient,
): Promise<string> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === SECOND_PARENT.email);
  let userId = existing?.id;

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: SECOND_PARENT.email,
      phone: SECOND_PARENT.phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        firstName: SECOND_PARENT.firstName,
        lastName: SECOND_PARENT.lastName,
        phone: SECOND_PARENT.phone,
        phone_verified: true,
      },
    });
    if (error || !created.user) {
      throw new Error(`יצירת ההורה השני נכשלה: ${error?.message}`);
    }
    userId = created.user.id;
  }

  // שער השם של ה-middleware דורש שורת פרופיל
  await admin.from("user_profiles").upsert({
    id: userId,
    first_name: SECOND_PARENT.firstName,
    last_name: SECOND_PARENT.lastName,
  });
  return userId;
}

export async function createCard(
  admin: SupabaseClient,
  params: {
    userId: string;
    gender: "male" | "female";
    firstName: string;
    lastName: string;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: params.userId,
      first_name: params.firstName,
      last_name: params.lastName,
      birth_date: "1998-01-01",
      gender: params.gender,
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת כרטיס לבדיקה נכשלה: ${error?.message}`);
  }
  return data.id as string;
}

/** הצעה שנשלחה (או טיוטה) עם היקף שליחה מפורש */
export async function insertProposal(
  admin: SupabaseClient,
  params: {
    groomId: string;
    brideId: string;
    shadchanId: string;
    status?: "draft" | "sent";
    scope?: "both" | "groom_only" | "bride_only";
  },
): Promise<string> {
  const isDraft = (params.status ?? "sent") === "draft";
  const { data, error } = await admin
    .from("shidduchim")
    .insert({
      groom_id: params.groomId,
      bride_id: params.brideId,
      shadchan_id: params.shadchanId,
      status: isDraft ? "draft" : "sent",
      recipient_scope: isDraft ? null : (params.scope ?? "both"),
      sent_at: isDraft ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת הצעה לבדיקה נכשלה: ${error?.message}`);
  }
  return data.id as string;
}

/** לקוח מחובר כמשתמש נתון (JWT אמיתי) — כך נבדקות ההרשאות ב-RPC וב-RLS */
export async function clientAs(
  admin: SupabaseClient,
  email: string,
): Promise<SupabaseClient> {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(`יצירת קישור כניסה ל-${email} נכשלה: ${error?.message}`);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: otpError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (otpError) {
    throw new Error(`כניסה כ-${email} נכשלה: ${otpError.message}`);
  }
  return client;
}

/** עמוד בדפדפן מחובר כמשתמש אחר (למשל ההורה), בהקשר נפרד ממשתמש הבדיקה */
export async function pageAs(
  browser: Browser,
  admin: SupabaseClient,
  email: string,
  next: string,
): Promise<Page> {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(`יצירת קישור כניסה ל-${email} נכשלה: ${error?.message}`);
  }
  const context = await browser.newContext({ locale: "he-IL" });
  const page = await context.newPage();
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.goto(
    `${base}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
  // ה-GET מציג מסך אישור (סורקי קישורים לא צורכים את האסימון); הלחיצה מכניסה
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/app"));
  return page;
}

type RoomTarget =
  | { kind: "general" }
  | { kind: "student"; studentId: string }
  | { kind: "shidduch"; shidduchId: string };

/** קריאה ל-get_or_create_context_room כמשתמש. מחזיר room_id או את השגיאה. */
export async function openRoomAs(
  client: SupabaseClient,
  otherUserId: string,
  target: RoomTarget,
): Promise<{ roomId: string | null; error: string | null }> {
  const { data, error } = await client.rpc("get_or_create_context_room", {
    other_user_id: otherUserId,
    p_context_kind: target.kind,
    p_student_id: target.kind === "student" ? target.studentId : null,
    p_shidduch_id: target.kind === "shidduch" ? target.shidduchId : null,
  });
  return {
    roomId: (data as string | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function getRoom(
  admin: SupabaseClient,
  roomId: string,
): Promise<ContextRoomRow | null> {
  const { data, error } = await admin
    .from("chat_rooms")
    .select("room_id, context_kind, student_id, shidduch_id, context_label")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw new Error(`קריאת החדר נכשלה: ${error.message}`);
  return data as ContextRoomRow | null;
}

/** מוחק את כל החדרים (וההתראות שלהם) בין המשתמשים הנתונים */
export async function deleteRoomsAmong(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<void> {
  const { data } = await admin
    .from("chat_rooms")
    .select("room_id")
    .in("user_a", userIds)
    .in("user_b", userIds);
  const roomIds = (data ?? []).map((r) => r.room_id as string);
  if (roomIds.length === 0) return;
  await admin.from("notifications").delete().in("related_id", roomIds);
  const { error } = await admin
    .from("chat_rooms")
    .delete()
    .in("room_id", roomIds);
  if (error) throw new Error(`ניקוי חדרי הבדיקה נכשל: ${error.message}`);
}

export async function sendAs(
  admin: SupabaseClient,
  roomId: string,
  senderId: string,
  content: string,
): Promise<void> {
  const { error } = await admin
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: senderId, content });
  if (error) throw new Error(`שליחת הודעה נכשלה: ${error.message}`);
}
