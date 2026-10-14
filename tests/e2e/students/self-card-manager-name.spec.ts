/**
 * Callers: Playwright `chromium` project (שדכן, שהוא גם בעל הכרטיסים שלו).
 * שם מנהל/ת הכרטיס בכרטיס "עבור עצמי": חובה, מתמלא מראש משם החשבון בעריכה
 * של הבעלים כשחסר, אינו חובה לעורך שאינו הבעלים, נשמר ב-author_info.name
 * ומוצג בכרטיס. גם "מי ממלא את הכרטיס?" נדרש בעריכה של כרטיס ישן בלעדיו.
 */
import { expect, test, type Page } from "@playwright/test";

import { approvedCard } from "../helpers/approved-card";
import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

const admin = createServiceClient();
const RUN_ID = Date.now();
const SAVE_BUTTON = "שמירת שינויים";
const SUCCESS_MESSAGE = "השינויים נשמרו בהצלחה!";
const ACCOUNT_NAME = "Test User";
const NAME_MISSING_MESSAGE = "נא למלא שם מנהל/ת הכרטיס";
const SAVE_TIMEOUT_MS = 20_000;
const SLOW_TEST_TIMEOUT_MS = 90_000;
const STEP_INTRO = "הקדמה";

const nameParts = (name: string) => ({ prefix: "", name, suffix: "" });

/** כרטיס שלם שעובר את כל שדות החובה; ההבדלים: הבעלים, card_for ו-author_info */
async function createCard(options: {
  userId: string;
  tag: string;
  cardFor: "self" | null;
  authorInfo: Record<string, string>;
}): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert(
      approvedCard({
        user_id: options.userId,
        first_name: "שם-מנהל",
        last_name: `${options.tag}${RUN_ID}`,
        card_for: options.cardFor,
        birth_date: "1997-03-03",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        street: "רבי עקיבא",
        house: "12",
        cellphone_type: "kosher",
        in_shidduchim: true,
        parents_info: {
          father: {
            self: nameParts("אברהם"),
            phone: "0501111111",
            job: "מלמד",
            email: "",
            grandFather: nameParts("יצחק"),
            grandMother: nameParts("שרה"),
          },
          mother: {
            self: nameParts("רחל"),
            maidenName: "לוי",
            phone: "0502222222",
            job: "מורה",
            email: "",
            grandFather: nameParts("יעקב"),
            grandMother: nameParts("לאה"),
          },
        },
        family_info: {
          numberOfChildren: 6,
          currentChildPlace: 2,
          about: "משפחה תורנית",
          mechutanim: [],
        },
        author_info: options.authorInfo,
      }),
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
  const id = data.id as string;
  const { error: preferencesError } = await admin
    .from("partner_preferences")
    .insert({ student_id: id, additional_information: "מחפשים בת תורה" });
  if (preferencesError) {
    throw new Error(`הכנת העדפות נכשלה: ${preferencesError.message}`);
  }
  return id;
}

async function readAuthorInfo(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from("students")
    .select("author_info")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`קריאה נכשלה: ${error?.message}`);
  return (data.author_info ?? {}) as Record<string, unknown>;
}

const saveButton = (page: Page) =>
  page.getByRole("button", { name: SAVE_BUTTON, exact: true });

async function openIntro(page: Page, id: string) {
  await page.goto(`/app/students/${id}/edit`);
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: STEP_INTRO, exact: true })
    .click();
  await expect(page.locator("#author-email")).toBeVisible();
}

test.describe.serial("שם מנהל/ת הכרטיס בכרטיס 'עבור עצמי'", () => {
  const cardIds: string[] = [];
  let ownerOldCard: string;
  let ownerNamedCard: string;
  let foreignCard: string;
  let legacyCard: string;

  test.beforeAll(async () => {
    const ownerId = await getTestUserId(admin);
    const otherOwnerId = await ensureCardManagerId(admin);
    ownerOldCard = await createCard({
      userId: ownerId,
      tag: "ישן",
      cardFor: "self",
      authorInfo: { email: "old-self@example.test" },
    });
    ownerNamedCard = await createCard({
      userId: ownerId,
      tag: "בעל-שם",
      cardFor: "self",
      authorInfo: { name: "מנהל קיים", email: "named-self@example.test" },
    });
    foreignCard = await createCard({
      userId: otherOwnerId,
      tag: "זר",
      cardFor: "self",
      authorInfo: { email: "foreign-self@example.test" },
    });
    legacyCard = await createCard({
      userId: ownerId,
      tag: "בלי-עבור-מי",
      cardFor: null,
      authorInfo: {},
    });
    cardIds.push(ownerOldCard, ownerNamedCard, foreignCard, legacyCard);
  });

  test.afterAll(async () => {
    if (cardIds.length > 0) {
      await admin.from("students").delete().in("id", cardIds);
    }
  });

  test("כרטיס ישן בלי שם, אצל הבעלים: השדה מתמלא משם החשבון, ונשמר", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    await openIntro(page, ownerOldCard);

    // Assert: מילוי מראש, ושם הכרטיס הישן אינו חסר
    const nameField = page.locator("#author-name");
    await expect(nameField).toHaveValue(ACCOUNT_NAME);

    // Act: עריכה ושמירה
    await nameField.fill("מנהל הכרטיס החדש");
    await saveButton(page).click();

    // Assert
    await expect(page.getByText(SUCCESS_MESSAGE).first()).toBeVisible({
      timeout: SAVE_TIMEOUT_MS,
    });
    const info = await readAuthorInfo(ownerOldCard);
    expect(info).toMatchObject({
      name: "מנהל הכרטיס החדש",
      email: "old-self@example.test",
    });
    // "עבור עצמי" לא שומר טלפון, קשר ושאר פרטי ממלא
    expect(info.phone).toBe("");
    expect(info.relationType).toBeNull();
  });

  test("הבעלים מרוקן את השם: השמירה נחסמת עם הודעה על השדה", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    await openIntro(page, ownerNamedCard);
    const nameField = page.locator("#author-name");
    await expect(nameField).toHaveValue("מנהל קיים");

    // Act
    await nameField.fill("   ");
    await saveButton(page).click();

    // Assert
    await expect(page.getByText(NAME_MISSING_MESSAGE)).toBeVisible();
    expect((await readAuthorInfo(ownerNamedCard)).name).toBe("מנהל קיים");
  });

  test("עורך שאינו הבעלים: השדה ריק ואינו חובה, והשמירה עוברת", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    await openIntro(page, foreignCard);

    // Assert: לא ממלאים בשבילו, ואין כוכבית חובה
    const nameField = page.locator("#author-name");
    await expect(nameField).toHaveValue("");
    await expect(nameField).not.toHaveAttribute("aria-required", "true");

    // Act
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים אישיים", exact: true })
      .click();
    await page.locator("#street").fill("רחוב הזר");
    await saveButton(page).click();

    // Assert
    await expect(page.getByText(SUCCESS_MESSAGE).first()).toBeVisible({
      timeout: SAVE_TIMEOUT_MS,
    });
    expect((await readAuthorInfo(foreignCard)).name ?? "").toBe("");
  });

  test("כרטיס ישן בלי 'מי ממלא': ההמשך נחסם עד שהבעלים בוחר, והשם מתמלא", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);
    await page.goto(`/app/students/${legacyCard}/edit`);
    const stepsNav = page.getByRole("navigation", { name: "שלבי הטופס" });
    const nextStep = stepsNav.getByRole("button", {
      name: "פרטים אישיים",
      exact: true,
    });

    // Assert: בלי בחירה אי אפשר להמשיך לשלבים הבאים (ולכן גם לא לשמור אותם)
    await expect(nextStep).toBeDisabled({ timeout: 15_000 });
    await expect(page.locator("#author-name")).toHaveCount(0);

    // Act: בחירת "עבור עצמי"
    await page.getByRole("radio", { name: "המיועד/ת בעצמו/ה" }).check();

    // Assert: השלבים נפתחו, והשם מולא משם החשבון (הבעלים, השם חסר)
    await expect(nextStep).toBeEnabled();
    await expect(page.locator("#author-name")).toHaveValue(ACCOUNT_NAME);
    const { data } = await admin
      .from("students")
      .select("card_for")
      .eq("id", legacyCard)
      .single();
    expect(data?.card_for).toBeNull();
  });

  test("הכרטיס מציג את שם המנהל, בלי האימייל של כרטיס 'עבור עצמי'", async ({
    page,
  }) => {
    await page.goto(`/app/students/${ownerNamedCard}`);

    const card = page.getByTestId("author-info-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText("מנהל קיים");
    await expect(card.getByTestId("author-email")).toHaveCount(0);
  });
});
