import { expect, test, type Browser, type Page } from "@playwright/test";

import { createUserSessionClient } from "../forums/forum-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";

/**
 * עריכת פרופיל שדכן מאושר בידי עצמו (הגדרות > עריכת פרופיל שדכן):
 * הטקסטים משתנים, הסטטוס ותאריכיו נשארים, ושדכן אחר לא יכול לערוך.
 * נוצרים שני שדכנים מאושרים נפרדים ונכנסים בדפדפן ללא ה-storageState.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const EMAIL_A = `shadchan-edit-a-${RUN_ID}@kol-mitzhalot.test`;
const EMAIL_B = `shadchan-edit-b-${RUN_ID}@kol-mitzhalot.test`;
const EMAIL_PARENT = `shadchan-edit-parent-${RUN_ID}@kol-mitzhalot.test`;
const EMAIL_ADMIN = `shadchan-edit-admin-${RUN_ID}@kol-mitzhalot.test`;
const CONTACT_PHONE = "0501234567";
const CONTACT_EMAIL = `contact-${RUN_ID}@kol-mitzhalot.test`;
const RABBI_MESSAGE = "נא למלא רב בית הכנסת שלך";
const SEED_SUBMITTED_AT = "2020-03-01T10:00:00.000Z";
const SEED_APPROVED_AT = "2020-03-05T10:00:00.000Z";
const SEED_BIO = "ביוגרפיה מקורית";
const NEW_BIO = "ביוגרפיה מעודכנת אחרי עריכה";
const SEED_RABBI = "הרב מקורי";

const admin = createServiceClient();
const ids = { a: "", b: "", parent: "", admin: "" };

async function createShadchan(email: string, phoneTail: string, name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone: `+9725${phoneTail}`,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles: ["shadchan"] },
    user_metadata: { firstName: name, lastName: "עריכה", phone_verified: true },
  });
  if (error || !data.user) throw new Error(`יצירת שדכן: ${error?.message}`);
  const id = data.user.id;
  await admin
    .from("user_profiles")
    .upsert({ id, first_name: name, last_name: "עריכה" });
  const { error: infoError } = await admin.from("shadchanim_info").insert({
    user_id: id,
    application_status: "approved",
    submitted_at: SEED_SUBMITTED_AT,
    approved_at: SEED_APPROVED_AT,
    bio: SEED_BIO,
    experience_years: 5,
    closed_matches: 3,
    contact_phone: CONTACT_PHONE,
    contact_email: CONTACT_EMAIL,
    community: "בעלזא",
    synagogue_rabbi: SEED_RABBI,
  });
  if (infoError) throw new Error(`שורת שדכן: ${infoError.message}`);
  return id;
}

async function createPlainUser(
  email: string,
  phoneTail: string,
  roles: string[],
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    phone: `+9725${phoneTail}`,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles },
    user_metadata: {
      firstName: "צופה",
      lastName: "בדיקה",
      phone_verified: true,
    },
  });
  if (error || !data.user) throw new Error(`יצירת משתמש: ${error?.message}`);
  await admin
    .from("user_profiles")
    .upsert({ id: data.user.id, first_name: "צופה", last_name: "בדיקה" });
  return data.user.id;
}

test.beforeAll(async () => {
  const tail = String(RUN_ID).slice(-8);
  ids.parent = await createPlainUser(
    EMAIL_PARENT,
    String(Number(tail) + 2).padStart(8, "0"),
    [],
  );
  ids.admin = await createPlainUser(
    EMAIL_ADMIN,
    String(Number(tail) + 3).padStart(8, "0"),
    ["admin"],
  );
  ids.a = await createShadchan(EMAIL_A, tail, "עורך");
  ids.b = await createShadchan(
    EMAIL_B,
    String(Number(tail) + 1).padStart(8, "0"),
    "אחר",
  );
});

test.afterAll(async () => {
  for (const id of [ids.a, ids.b, ids.parent, ids.admin]) {
    await admin.from("shadchanim_info").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
});

async function signIn(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  expect(error).toBeNull();
  await page.goto(
    `/auth/confirm?token_hash=${data?.properties?.hashed_token}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"), {
    timeout: LOAD_TIMEOUT,
  });
}

async function newSignedInPage(browser: Browser, email: string) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await signIn(page, email);
  return { page, context };
}

const rowOf = async (id: string) =>
  (
    await admin
      .from("shadchanim_info")
      .select(
        "bio, application_status, submitted_at, approved_at, rejected_at, synagogue_rabbi",
      )
      .eq("user_id", id)
      .single()
  ).data;

test.beforeEach(async () => {
  await admin
    .from("shadchanim_info")
    .update({ bio: SEED_BIO, synagogue_rabbi: SEED_RABBI })
    .eq("user_id", ids.a);
});

test.describe("עריכת פרופיל שדכן מאושר - עצמית", () => {
  test("שדכן מאושר עורך את הפרופיל, והסטטוס ותאריכיו נשארים", async ({
    browser,
  }) => {
    // Arrange
    const { page, context } = await newSignedInPage(browser, EMAIL_A);
    await page.goto("/app/settings/shadchan");
    await expect(
      page.getByRole("heading", { name: "עריכת פרופיל שדכן", level: 1 }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByLabel("ביוגרפיה")).toHaveValue(SEED_BIO);

    // Act
    await page.getByLabel("ביוגרפיה").fill(NEW_BIO);
    await page.getByRole("button", { name: "שמור שינויים" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/shadchanim/${ids.a}$`), {
      timeout: LOAD_TIMEOUT,
    });

    // Assert - הטקסט השתנה והסטטוס ותאריכיו לא
    const row = await rowOf(ids.a);
    expect(row?.bio).toBe(NEW_BIO);
    expect(row?.application_status).toBe("approved");
    expect(new Date(row?.submitted_at ?? "").toISOString()).toBe(
      SEED_SUBMITTED_AT,
    );
    expect(new Date(row?.approved_at ?? "").toISOString()).toBe(
      SEED_APPROVED_AT,
    );
    expect(row?.rejected_at).toBeNull();
    // :not([data-testid]) - בזמן המעבר עוד מוצגת התצוגה המקדימה של הטופס
    await expect(
      page.locator("p:not([data-testid])", { hasText: NEW_BIO }),
    ).toBeVisible();
    await context.close();
  });

  test("כפתור עריכת הפרופיל מופיע רק בפרופיל של עצמך", async ({ browser }) => {
    // Arrange
    const own = await newSignedInPage(browser, EMAIL_A);
    const other = await newSignedInPage(browser, EMAIL_B);

    // Act
    await own.page.goto(`/app/shadchanim/${ids.a}`);
    await other.page.goto(`/app/shadchanim/${ids.a}`);

    // Assert
    await expect(
      own.page.getByRole("link", { name: "עריכת הפרופיל" }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(
      other.page.getByRole("heading", { name: "אודות" }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(
      other.page.getByRole("link", { name: "עריכת הפרופיל" }),
    ).toHaveCount(0);
    await own.context.close();
    await other.context.close();
  });

  test("הרב נשאר שדה חובה בעריכה", async ({ browser }) => {
    // Arrange
    const { page, context } = await newSignedInPage(browser, EMAIL_A);
    await page.goto("/app/settings/shadchan");
    await expect(page.getByLabel("רב בית הכנסת שלך")).toHaveValue(SEED_RABBI, {
      timeout: LOAD_TIMEOUT,
    });

    // Act
    await page.getByLabel("רב בית הכנסת שלך").fill("");
    await page.getByRole("button", { name: "שמור שינויים" }).click();

    // Assert
    await expect(page.getByText(RABBI_MESSAGE)).toBeVisible();
    expect((await rowOf(ids.a))?.synagogue_rabbi).toBe(SEED_RABBI);
    await context.close();
  });
});

test.describe("עריכת פרופיל שדכן מאושר - הגנות במסד", () => {
  test("עדכון ישיר של סטטוס ותאריכים בידי השדכן עצמו לא משנה אותם", async () => {
    // Arrange
    const session = await createUserSessionClient(admin, EMAIL_A);

    // Act
    const { error } = await session
      .from("shadchanim_info")
      .update({
        application_status: "pending",
        submitted_at: "2026-01-01T00:00:00.000Z",
        approved_at: "2026-01-01T00:00:00.000Z",
        bio: NEW_BIO,
      })
      .eq("user_id", ids.a);

    // Assert - הטקסט נשמר, שדות ההחלטה והגשה נשמרו כמו שהיו
    expect(error).toBeNull();
    const row = await rowOf(ids.a);
    expect(row?.bio).toBe(NEW_BIO);
    expect(row?.application_status).toBe("approved");
    expect(new Date(row?.submitted_at ?? "").toISOString()).toBe(
      SEED_SUBMITTED_AT,
    );
    expect(new Date(row?.approved_at ?? "").toISOString()).toBe(
      SEED_APPROVED_AT,
    );
  });

  test("המסד דוחה ריקון הרב בפרופיל מאושר", async () => {
    // Arrange
    const session = await createUserSessionClient(admin, EMAIL_A);

    // Act
    const { error } = await session
      .from("shadchanim_info")
      .update({ synagogue_rabbi: "  " })
      .eq("user_id", ids.a);

    // Assert
    expect(error?.message).toBe("shadchan_application_incomplete");
    expect((await rowOf(ids.a))?.synagogue_rabbi).toBe(SEED_RABBI);
  });

  test("שדכן אחר לא יכול לעדכן את הפרופיל", async () => {
    // Arrange
    const other = await createUserSessionClient(admin, EMAIL_B);

    // Act
    const { data } = await other
      .from("shadchanim_info")
      .update({ bio: "פריצה" })
      .eq("user_id", ids.a)
      .select("user_id");

    // Assert
    expect(data ?? []).toHaveLength(0);
    expect((await rowOf(ids.a))?.bio).toBe(SEED_BIO);
  });

  test("הקהילה ורב בית הכנסת לא מופיעים בפרופיל הציבורי", async () => {
    // Arrange
    const viewer = await createUserSessionClient(admin, EMAIL_B);

    // Act
    const { data, error } = await viewer.rpc("get_shadchan_public_profile", {
      p_shadchan_id: ids.a,
    });
    const { data: listed } = await viewer.rpc("list_approved_shadchanim");

    // Assert
    expect(error).toBeNull();
    const profile = (data as Record<string, unknown>[])[0];
    expect(profile).toBeTruthy();
    for (const hidden of ["community", "synagogue_rabbi"]) {
      expect(profile).not.toHaveProperty(hidden);
    }
    expect(JSON.stringify([data, listed])).not.toContain(SEED_RABBI);
  });
});

test.describe("טלפון ואימייל של שדכן - רק לשדכן עצמו ולמנהל", () => {
  type ProfileRow = { phone: string | null; email: string | null };

  async function profileAs(email: string): Promise<ProfileRow | undefined> {
    const session = await createUserSessionClient(admin, email);
    const { data, error } = await session.rpc("get_shadchan_public_profile", {
      p_shadchan_id: ids.a,
    });
    expect(error).toBeNull();
    return (data as ProfileRow[])[0];
  }

  test("הורה ושדכן אחר מקבלים מהפרופיל הציבורי טלפון ואימייל ריקים", async () => {
    // Act
    const asParent = await profileAs(EMAIL_PARENT);
    const asOther = await profileAs(EMAIL_B);

    // Assert - הפרופיל עצמו חוזר, בלי פרטי הקשר
    for (const row of [asParent, asOther]) {
      expect(row).toBeTruthy();
      expect(row?.phone).toBeNull();
      expect(row?.email).toBeNull();
    }
  });

  test("השדכן עצמו ומנהל מקבלים טלפון ואימייל", async () => {
    // Act
    const asOwner = await profileAs(EMAIL_A);
    const asAdmin = await profileAs(EMAIL_ADMIN);

    // Assert
    for (const row of [asOwner, asAdmin]) {
      expect(row?.phone).toBe(CONTACT_PHONE);
      expect(row?.email).toBe(CONTACT_EMAIL);
    }
  });

  test("הורה ושדכן אחר לא קוראים את פרטי הקשר ישירות מאף טבלה", async () => {
    for (const email of [EMAIL_PARENT, EMAIL_B]) {
      // Arrange
      const session = await createUserSessionClient(admin, email);

      // Act
      const { data: info } = await session
        .from("shadchanim_info")
        .select("contact_phone, contact_email")
        .eq("user_id", ids.a);
      const { data: profiles } = await session
        .from("user_profiles")
        .select("email")
        .eq("id", ids.a);
      const { data: listed } = await session.rpc("list_approved_shadchanim");

      // Assert
      expect(info ?? []).toHaveLength(0);
      expect(profiles ?? []).toHaveLength(0);
      expect(JSON.stringify(listed)).not.toContain(CONTACT_PHONE);
      expect(JSON.stringify(listed)).not.toContain(CONTACT_EMAIL);
    }
  });

  test("הורה רואה פרופיל בלי טלפון ואימייל, עם כפתור פניה לשדכן שעובד", async ({
    browser,
  }) => {
    // Arrange
    const { page, context } = await newSignedInPage(browser, EMAIL_PARENT);

    // Act
    await page.goto(`/app/shadchanim/${ids.a}`);
    await expect(page.getByRole("heading", { name: "אודות" })).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });

    // Assert
    await expect(page.getByText(CONTACT_PHONE)).toHaveCount(0);
    await expect(page.getByText(CONTACT_EMAIL)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "פרטי התקשרות" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "פניה לשדכן" }).click();
    await page.getByLabel("הודעה").fill("שלום, אשמח לשוחח");
    await page.getByRole("button", { name: "שליחת פנייה" }).click();
    await expect(page).toHaveURL(/\/app\/chats\//, { timeout: LOAD_TIMEOUT });
    await context.close();
  });

  test("השדכן עצמו ומנהל רואים טלפון ואימייל עם הערת פרטיות", async ({
    browser,
  }) => {
    for (const email of [EMAIL_A, EMAIL_ADMIN]) {
      // Arrange
      const { page, context } = await newSignedInPage(browser, email);

      // Act
      await page.goto(`/app/shadchanim/${ids.a}`);

      // Assert
      await expect(page.getByRole("link", { name: CONTACT_PHONE })).toBeVisible(
        {
          timeout: LOAD_TIMEOUT,
        },
      );
      await expect(
        page.getByRole("link", { name: CONTACT_EMAIL }),
      ).toBeVisible();
      await expect(page.getByText("גלויים רק לך ולהנהלת האתר")).toBeVisible();
      await context.close();
    }
  });
});
