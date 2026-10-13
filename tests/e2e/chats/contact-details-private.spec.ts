import { expect, test, type Browser, type Page } from "@playwright/test";

import { createUserSessionClient } from "../forums/forum-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";

/**
 * פרטי קשר של משתמשים לא נחשפים לאחרים: טלפון ואימייל של שדכן ב"שדכנים
 * שפעלו בשבילך", ואימייל התחברות של שותף שיחה (get_user_metadata ו-
 * user_profiles). לעצמי ולמנהל הערכים נשארים. הכל בסשנים אמיתיים.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const NEUTRAL_NAME = "משתמש/ת";
const SHADCHAN_FIRST = "דוברת";
const CONTACT_PHONE = "0507654321";
const CONTACT_EMAIL = `contact-priv-${RUN_ID}@kol-mitzhalot.test`;
const EMAILS = {
  shadchan: `priv-shadchan-${RUN_ID}@kol-mitzhalot.test`,
  parent: `priv-parent-${RUN_ID}@kol-mitzhalot.test`,
  nameless: `priv-nameless-${RUN_ID}@kol-mitzhalot.test`,
  admin: `priv-admin-${RUN_ID}@kol-mitzhalot.test`,
};

const service = createServiceClient();
const ids = { shadchan: "", parent: "", nameless: "", admin: "" };
const roomIds: string[] = [];

async function createUser(
  email: string,
  phoneOffset: number,
  roles: string[],
  names: { first: string; last: string } | null,
) {
  const tail = String(RUN_ID + phoneOffset).slice(-8);
  const { data, error } = await service.auth.admin.createUser({
    email,
    phone: `+9725${tail}`,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles },
    user_metadata: {
      firstName: names?.first ?? "זמני",
      lastName: names?.last ?? "זמני",
      phone_verified: true,
    },
  });
  if (error || !data.user) throw new Error(`יצירת משתמש: ${error?.message}`);
  const id = data.user.id;
  if (names) {
    await service
      .from("user_profiles")
      .upsert({ id, first_name: names.first, last_name: names.last });
  } else {
    // ההרשמה דורשת שם; כאן מוחקים אותו כדי לשחזר משתמש בלי שם
    await service.auth.admin.updateUserById(id, {
      user_metadata: { firstName: "", lastName: "", phone_verified: true },
    });
    await service.from("user_profiles").delete().eq("id", id);
  }
  return id;
}

async function createRoom(a: string, b: string, createdBy: string) {
  const [userA, userB] = [a, b].sort();
  const { data, error } = await service
    .from("chat_rooms")
    .insert({ user_a: userA, user_b: userB, created_by: createdBy })
    .select("room_id")
    .single();
  if (error || !data) throw new Error(`יצירת חדר: ${error?.message}`);
  const roomId = data.room_id as string;
  const { error: participantsError } = await service
    .from("chat_room_participants")
    .insert([
      { room_id: roomId, user_id: a },
      { room_id: roomId, user_id: b },
    ]);
  if (participantsError) throw new Error(participantsError.message);
  roomIds.push(roomId);
}

test.beforeAll(async () => {
  ids.shadchan = await createUser(EMAILS.shadchan, 0, ["shadchan"], {
    first: SHADCHAN_FIRST,
    last: "פרטיות",
  });
  ids.parent = await createUser(EMAILS.parent, 1, [], {
    first: "הורה",
    last: "פרטיות",
  });
  ids.nameless = await createUser(EMAILS.nameless, 2, [], null);
  ids.admin = await createUser(EMAILS.admin, 3, ["admin"], {
    first: "מנהל",
    last: "פרטיות",
  });
  const { error } = await service.from("shadchanim_info").insert({
    user_id: ids.shadchan,
    application_status: "approved",
    bio: "ביוגרפיה",
    experience_years: 4,
    closed_matches: 2,
    contact_phone: CONTACT_PHONE,
    contact_email: CONTACT_EMAIL,
    community: "בעלזא",
    synagogue_rabbi: "הרב",
  });
  if (error) throw new Error(`שורת שדכן: ${error.message}`);
  // השדכן פנה להורה (פעולת "message"), ולהורה יש גם שיחה עם משתמש בלי שם
  await createRoom(ids.shadchan, ids.parent, ids.shadchan);
  await createRoom(ids.parent, ids.nameless, ids.nameless);
});

test.afterAll(async () => {
  for (const roomId of roomIds) {
    await service.from("chat_rooms").delete().eq("room_id", roomId);
  }
  await service.from("shadchanim_info").delete().eq("user_id", ids.shadchan);
  for (const id of Object.values(ids).filter(Boolean)) {
    await service.auth.admin.deleteUser(id);
  }
});

async function signedInPage(browser: Browser, email: string) {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  expect(error).toBeNull();
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page: Page = await context.newPage();
  await page.goto(
    `/auth/confirm?token_hash=${data?.properties?.hashed_token}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"), {
    timeout: LOAD_TIMEOUT,
  });
  return { page, context };
}

type Metadata = { firstName: string | null; email: string | null } | null;

async function metadataAs(viewerEmail: string, targetId: string) {
  const session = await createUserSessionClient(service, viewerEmail);
  const { data, error } = await session.rpc("get_user_metadata", {
    target_user_id: targetId,
  });
  expect(error).toBeNull();
  return data as Metadata;
}

test.describe("שדכנים שפעלו בשבילך - בלי טלפון ואימייל", () => {
  test("ה-RPC מחזיר את השדכן בלי טלפון ואימייל", async () => {
    // Arrange
    const parent = await createUserSessionClient(service, EMAILS.parent);

    // Act
    const { data, error } = await parent.rpc("get_shadchanim_who_acted_for_me");

    // Assert
    expect(error).toBeNull();
    const rows = data as {
      shadchan_id: string;
      phone: unknown;
      email: unknown;
    }[];
    const row = rows.find((r) => r.shadchan_id === ids.shadchan);
    expect(row).toBeTruthy();
    expect(row?.phone).toBeNull();
    expect(row?.email).toBeNull();
    expect(JSON.stringify(data)).not.toContain(CONTACT_PHONE);
    expect(JSON.stringify(data)).not.toContain(CONTACT_EMAIL);
  });

  test("הכרטיס בדשבורד בלי פרטי קשר, והדיאלוג 'פניה לשדכן' נפתח", async ({
    browser,
  }) => {
    // Arrange
    const { page, context } = await signedInPage(browser, EMAILS.parent);

    // Act
    await page.goto("/app");
    const card = page
      .locator("div", { hasText: SHADCHAN_FIRST })
      .filter({ has: page.getByRole("button", { name: "פניה לשדכן" }) })
      .last();
    await expect(card).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Assert
    await expect(page.getByText(CONTACT_PHONE)).toHaveCount(0);
    await expect(page.getByText(CONTACT_EMAIL)).toHaveCount(0);
    await expect(
      page.locator('a[href^="tel:"], a[href^="mailto:"]'),
    ).toHaveCount(0);
    await card.getByRole("button", { name: "פניה לשדכן" }).click();
    await expect(page.getByLabel("הודעה")).toBeVisible();
    await context.close();
  });
});

test.describe("אימייל התחברות - לעצמי ולמנהל בלבד", () => {
  test("שותף שיחה לא מקבל אימייל מ-get_user_metadata, אבל כן שם", async () => {
    // Act
    const shadchanSeen = await metadataAs(EMAILS.parent, ids.shadchan);
    const parentSeenByShadchan = await metadataAs(EMAILS.shadchan, ids.parent);

    // Assert
    expect(shadchanSeen?.firstName).toBe(SHADCHAN_FIRST);
    expect(shadchanSeen?.email).toBeNull();
    expect(parentSeenByShadchan?.email).toBeNull();
  });

  test("המשתמש עצמו ומנהל מקבלים את האימייל", async () => {
    // Act
    const own = await metadataAs(EMAILS.parent, ids.parent);
    const byAdmin = await metadataAs(EMAILS.admin, ids.parent);

    // Assert
    expect(own?.email).toBe(EMAILS.parent);
    expect(byAdmin?.email).toBe(EMAILS.parent);
  });

  test("שותף שיחה לא קורא אימייל ישירות מ-user_profiles, ועצמי כן", async () => {
    // Arrange
    const parent = await createUserSessionClient(service, EMAILS.parent);

    // Act
    const { data: other } = await parent
      .from("user_profiles")
      .select("email")
      .eq("id", ids.shadchan);
    const { data: own } = await parent
      .from("user_profiles")
      .select("id")
      .eq("id", ids.parent);

    // Assert
    expect(other ?? []).toHaveLength(0);
    expect(own ?? []).toHaveLength(1);
  });
});

test.describe("שמות בצ'אט", () => {
  test("הרשימה מציגה שם שדכן, ותווית ניטרלית למשתמש בלי שם", async ({
    browser,
  }) => {
    // Arrange
    const { page, context } = await signedInPage(browser, EMAILS.parent);

    // Act
    await page.goto("/app/chats");

    // Assert
    await expect(page.getByText(SHADCHAN_FIRST).first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByText(NEUTRAL_NAME).first()).toBeVisible();
    await expect(page.getByText(/priv-nameless/)).toHaveCount(0);
    await context.close();
  });
});

test.describe("הפרופיל של השדכן עצמו", () => {
  test("השדכן רואה את הטלפון והאימייל שלו", async ({ browser }) => {
    // Arrange
    const { page, context } = await signedInPage(browser, EMAILS.shadchan);

    // Act
    await page.goto(`/app/shadchanim/${ids.shadchan}`);

    // Assert
    await expect(page.getByRole("link", { name: CONTACT_PHONE })).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByRole("link", { name: CONTACT_EMAIL })).toBeVisible();
    await context.close();
  });
});
