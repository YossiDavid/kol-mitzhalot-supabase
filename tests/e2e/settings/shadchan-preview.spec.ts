import { expect, test, type Page } from "@playwright/test";

import { createUserSessionClient } from "../forums/forum-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";
import { fillShadchanIdentity } from "../helpers/shadchan-form";

/**
 * טופס ההצטרפות כשדכן: תצוגה מקדימה חיה של כרטיס הרשימה, הנחיית הכתיבה
 * מעל הביוגרפיה, ושדה "למה כדאי לאשר אותי" שנשמר ואינו נחשף לאחרים.
 * נוצר מגיש נפרד שנכנס בדפדפן ללא ה-storageState.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const LOAD_TIMEOUT = 15_000;
const RUN_ID = Date.now();
const EMAIL_APPLICANT = `preview-applicant-${RUN_ID}@kol-mitzhalot.test`;
const EMAIL_OTHER = `preview-other-${RUN_ID}@kol-mitzhalot.test`;
const APPLICANT_FIRST = "מגישה";
const APPLICANT_LAST = `תצוגה${RUN_ID}`;
const OTHER_NOTE = `הערה-פרטית-של-אחר-${RUN_ID}`;
const OWN_NOTE = `בבקשה לאשר אותי ${RUN_ID}`;
const BIO = "אני שדכנית בגוף ראשון ומתמחה בשידוכים לצעירים";
const CITY = "בני ברק";

const service = createServiceClient();
const ids = { applicant: "", other: "" };

async function createUser(
  email: string,
  phoneTail: string,
  firstName: string,
  lastName: string,
  roles: string[],
) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    phone: `+9725${phoneTail}`,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles },
    user_metadata: { firstName, lastName, phone_verified: true },
  });
  if (error || !data.user) throw new Error(`יצירת משתמש: ${error?.message}`);
  await service
    .from("user_profiles")
    .upsert({ id: data.user.id, first_name: firstName, last_name: lastName });
  return data.user.id;
}

test.beforeAll(async () => {
  const tail = Number(String(RUN_ID).slice(-8));
  ids.applicant = await createUser(
    EMAIL_APPLICANT,
    String(tail).padStart(8, "0"),
    APPLICANT_FIRST,
    APPLICANT_LAST,
    [],
  );
  ids.other = await createUser(
    EMAIL_OTHER,
    String(tail + 1).padStart(8, "0"),
    "אחרת",
    `פרטי${RUN_ID}`,
    ["shadchan"],
  );
  const { error } = await service.from("shadchanim_info").insert({
    user_id: ids.other,
    application_status: "approved",
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    bio: "תיאור ציבורי של שדכנית אחרת",
    application_note: OTHER_NOTE,
  });
  if (error) throw new Error(`שורת שדכן: ${error.message}`);
});

test.afterAll(async () => {
  for (const id of [ids.applicant, ids.other]) {
    await service.from("shadchanim_info").delete().eq("user_id", id);
    await service.auth.admin.deleteUser(id);
  }
});

async function openJoinForm(page: Page) {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL_APPLICANT,
  });
  expect(error).toBeNull();
  await page.goto(
    `/auth/confirm?token_hash=${data?.properties?.hashed_token}&type=magiclink&next=/app`,
  );
  await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"), {
    timeout: LOAD_TIMEOUT,
  });
  await page.goto("/app/settings/shadchan");
  await expect(
    page.getByRole("heading", { name: "הצטרפות כשדכן", level: 1 }),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
}

test.describe("הצטרפות כשדכן - תצוגה מקדימה והערה להנהלה", () => {
  test("התצוגה המקדימה היא כרטיס הרשימה ומתעדכנת בזמן ההקלדה", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1440, height: 900 });
    await openJoinForm(page);
    const preview = page.getByTestId("shadchan-card-preview");
    const card = preview.getByTestId("shadchan-card");

    // Assert - לפני הקלדה: השם מהמשתמש, התיאור ריק, בלי טקסט חלופי
    await expect(card.getByTestId("shadchan-card-name")).toHaveText(
      `${APPLICANT_FIRST} ${APPLICANT_LAST}`,
    );
    await expect(card.getByTestId("shadchan-card-description")).toHaveText("");
    await expect(preview).not.toContainText("לא זמין");

    // Act
    await page.getByLabel("ביוגרפיה").fill(BIO);
    await page.getByLabel("עיר", { exact: true }).fill(CITY);
    await page.getByLabel("שנות ניסיון").fill("3");
    await page.getByLabel("התמחויות").fill("צעירים, מבוגרים, גרושים, אלמנים");

    // Assert - מתעדכן חי
    await expect(card.getByTestId("shadchan-card-description")).toHaveText(BIO);
    await expect(card.getByTestId("shadchan-card-meta")).toContainText(CITY);
    await expect(card.getByTestId("shadchan-card-meta")).toContainText(
      `שדכן/ית משנת ${new Date().getFullYear() - 3}`,
    );
    await expect(
      card.getByTestId("shadchan-card-chips").locator("li"),
    ).toHaveCount(3);

    // Assert - תצוגה בלבד: הפעולות כבויות ואין קישור לפרופיל
    await expect(
      card.getByRole("button", { name: "לפרופיל המלא" }),
    ).toBeDisabled();
    await expect(
      card.getByRole("button", { name: "פניה לשדכן" }),
    ).toBeDisabled();
    await expect(card.getByRole("link")).toHaveCount(0);
  });

  test("הנחיית הכתיבה והשדה להנהלה מוצגים", async ({ page }) => {
    // Act
    await openJoinForm(page);
    const guidance = page.getByTestId("bio-guidance");

    // Assert
    await expect(guidance).toContainText("יוצג לכל המשתמשים ברשימת השדכנים");
    await expect(guidance).toContainText("כתבו בגוף ראשון");
    await expect(guidance).toContainText("הנהלה");
    await expect(page.getByLabel(/למה כדאי לאשר אותי/)).toBeVisible();
  });

  test("במובייל התצוגה המקדימה נפתחת מכותרת מעל כפתור השליחה", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 390, height: 844 });
    await openJoinForm(page);
    const toggle = page.getByRole("button", { name: "תצוגה מקדימה" });
    const card = page
      .getByTestId("shadchan-card-preview")
      .getByTestId("shadchan-card");

    // Assert - סגורה כברירת מחדל
    await expect(toggle).toBeVisible();
    await expect(card).toBeHidden();

    // Act
    await toggle.click();

    // Assert
    await expect(card).toBeVisible();
    const submitBox = await page
      .getByRole("button", { name: "שלח בקשה" })
      .boundingBox();
    const cardBox = await card.boundingBox();
    expect(cardBox!.y).toBeLessThan(submitBox!.y);
  });

  test("ההערה להנהלה נשמרת עם הבקשה", async ({ page }) => {
    // Arrange
    await service.from("shadchanim_info").delete().eq("user_id", ids.applicant);
    await openJoinForm(page);
    await page.getByLabel("ביוגרפיה").fill(BIO);
    await page.getByLabel("שנות ניסיון").fill("3");
    await page.getByLabel("כמה שידוכים סגרתי").fill("2");
    await page.getByLabel("טלפון ליצירת קשר").fill("0501234567");
    await page.locator("#community").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("רב בית הכנסת שלך").fill("הרב בדיקה");
    await page.getByLabel(/למה כדאי לאשר אותי/).fill(OWN_NOTE);
    await fillShadchanIdentity(page);

    // Act
    await page.getByRole("button", { name: "שלח בקשה" }).click();
    await expect(page).toHaveURL(/\/app\/settings$/, { timeout: LOAD_TIMEOUT });

    // Assert
    const { data } = await service
      .from("shadchanim_info")
      .select("application_note, bio")
      .eq("user_id", ids.applicant)
      .maybeSingle();
    expect(data?.application_note).toBe(OWN_NOTE);
    expect(data?.bio).toBe(BIO);
  });

  test("ההערה להנהלה אינה נחשפת למשתמש אחר, והבעלים קורא רק את שלו", async () => {
    // Arrange - הבקשה נשמרה בבדיקה הקודמת; כאן מבטיחים שהיא קיימת
    await service.from("shadchanim_info").upsert(
      {
        user_id: ids.applicant,
        application_status: "pending",
        submitted_at: new Date().toISOString(),
        application_note: OWN_NOTE,
      },
      { onConflict: "user_id" },
    );
    const viewer = await createUserSessionClient(service, EMAIL_APPLICANT);

    // Act
    const list = await viewer.rpc("list_approved_shadchanim");
    const profile = await viewer.rpc("get_shadchan_public_profile", {
      p_shadchan_id: ids.other,
    });
    const otherRow = await viewer
      .from("shadchanim_info")
      .select("application_note")
      .eq("user_id", ids.other);
    const ownRow = await viewer
      .from("shadchanim_info")
      .select("application_note")
      .eq("user_id", ids.applicant)
      .maybeSingle();

    // Assert
    expect(list.error).toBeNull();
    expect(profile.error).toBeNull();
    expect((list.data as unknown[]).length).toBeGreaterThan(0);
    expect((profile.data as unknown[]).length).toBe(1);
    expect(JSON.stringify(list.data)).not.toContain(OTHER_NOTE);
    expect(JSON.stringify(list.data)).not.toContain("application_note");
    expect(JSON.stringify(profile.data)).not.toContain(OTHER_NOTE);
    expect(JSON.stringify(profile.data)).not.toContain("application_note");
    expect(otherRow.data).toEqual([]);
    expect(ownRow.data?.application_note).toBe(OWN_NOTE);
  });
});
