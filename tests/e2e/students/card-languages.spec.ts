import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { clientAs } from "../chats/context-fixtures";
import { approvedCard } from "../helpers/approved-card";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  getTestUserId,
} from "../shidduchim/fixtures";
import { buildStudentPayload } from "../../../features/students/lib/build-student-payload";
import { studentToFormValues } from "../../../features/students/lib/student-to-form";
import { emptyStudentFormValues } from "../../../features/students/lib/student-form-wizard";
import { deleteCards } from "./third-party-card-fixtures";

/**
 * "שפת אם" ו"שפות נוספות" - מהטופס, דרך פונקציות הפרופיל, אל המסד, חזרה
 * לטופס ואל הכרטיס. "אחר" פותח טקסט חופשי, ורק הטקסט נשמר.
 */
const T = `${Date.now()}`.slice(-8);
const PERSONAL_STEP = "פרטים אישיים";
const SAVE_BUTTON = "שמירת שינויים";
// קומפילציית dev של דף העריכה ושל הכרטיס - מעבר ל-30s
const SLOW_TEST_TIMEOUT_MS = 90_000;
const SAVE_TIMEOUT_MS = 20_000;

let svc: SupabaseClient;
let matchmaker: SupabaseClient;
const cardIds: string[] = [];

function payloadWith(languages: {
  nativeLanguage: string;
  nativeLanguageOther?: string;
  languages: string[];
  languagesOther?: string;
}) {
  return buildStudentPayload({
    ...emptyStudentFormValues,
    cardFor: "child",
    gender: "female",
    firstName: "שפות",
    lastName: `שפות${T}`,
    birthDate: "1998-01-01",
    personalStatus: "single",
    country: "ישראל",
    city: "בני ברק",
    cellphoneType: "kosher",
    nativeLanguageOther: "",
    languagesOther: "",
    ...languages,
  });
}

async function stored(id: string) {
  const { data } = await svc
    .from("students")
    .select("native_language, languages")
    .eq("id", id)
    .single();
  return data;
}

async function createViaRpc(payload: Record<string, unknown>) {
  const { data: id, error } = await matchmaker.rpc(
    "create_full_student_profile",
    { payload },
  );
  expect(error, error?.message).toBeNull();
  cardIds.push(id as string);
  return id as string;
}

test.beforeAll(async () => {
  svc = createServiceClient();
  matchmaker = await clientAs(svc, TEST_USER_EMAIL);
});

test.afterAll(async () => {
  await deleteCards(svc, cardIds);
});

test.describe("שפות - פונקציות הפרופיל והמיפוי לטופס", () => {
  test("שפות מהרשימה נשמרות וחוזרות לטופס", async () => {
    // Act
    const id = await createViaRpc(
      payloadWith({ nativeLanguage: "אידיש", languages: ["עברית", "אנגלית"] }),
    );

    // Assert
    const row = await stored(id);
    expect(row).toEqual({
      native_language: "אידיש",
      languages: ["עברית", "אנגלית"],
    });
    const form = studentToFormValues({ ...row, id });
    expect(form.nativeLanguage).toBe("אידיש");
    expect(form.nativeLanguageOther).toBe("");
    expect(form.languages).toEqual(["עברית", "אנגלית"]);
    expect(form.languagesOther).toBe("");
  });

  test('"אחר": נשמר הטקסט שהוקלד, ובעריכה חוזר כ"אחר" + הטקסט', async () => {
    // Act
    const id = await createViaRpc(
      payloadWith({
        nativeLanguage: "אחר",
        nativeLanguageOther: " פרסית ",
        languages: ["אנגלית", "אחר"],
        languagesOther: "יוונית, טורקית, אנגלית",
      }),
    );

    // Assert
    const row = await stored(id);
    expect(row).toEqual({
      native_language: "פרסית",
      languages: ["אנגלית", "יוונית", "טורקית"],
    });
    const form = studentToFormValues({ ...row, id });
    expect(form.nativeLanguage).toBe("אחר");
    expect(form.nativeLanguageOther).toBe("פרסית");
    expect(form.languages).toEqual(["אנגלית", "אחר"]);
    expect(form.languagesOther).toBe("יוונית, טורקית");
  });

  test("בלי שפות: נשמר NULL (השדות רשות)", async () => {
    // Act
    const id = await createViaRpc(
      payloadWith({ nativeLanguage: "", languages: [] }),
    );

    // Assert
    expect(await stored(id)).toEqual({
      native_language: null,
      languages: null,
    });
  });

  test("עדכון בלי המפתחות (קוד ישן) משאיר את הערכים הקיימים", async () => {
    // Arrange
    const payload = payloadWith({
      nativeLanguage: "צרפתית",
      languages: ["עברית"],
    });
    const id = await createViaRpc(payload);
    const {
      native_language: _native,
      languages: _languages,
      ...legacy
    } = payload;
    void _native;
    void _languages;

    // Act
    const { error } = await matchmaker.rpc("update_full_student_profile", {
      p_student_id: id,
      payload: legacy,
    });

    // Assert
    expect(error, error?.message).toBeNull();
    expect(await stored(id)).toEqual({
      native_language: "צרפתית",
      languages: ["עברית"],
    });
  });
});

/** כרטיס אשה שעובר את שדות החובה בטופס (בכרטיס גבר התמונה חובה) */
async function seedEditableCard(): Promise<string> {
  const userId = await getTestUserId(svc);
  const nameParts = (name: string) => ({ prefix: "", name, suffix: "" });
  const { data, error } = await svc
    .from("students")
    .insert(
      approvedCard({
        user_id: userId,
        card_for: "child",
        first_name: "שפות",
        last_name: `בטופס${T}`,
        birth_date: "1997-03-03",
        gender: "female",
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
        author_info: {
          name: "כותב הבדיקה",
          phone: "0503333333",
          email: "author-languages@example.test",
          relation: "אב",
        },
      }),
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  cardIds.push(data.id as string);
  const { error: preferencesError } = await svc
    .from("partner_preferences")
    .insert({ student_id: data.id, additional_information: "מחפשים בן תורה" });
  if (preferencesError) {
    throw new Error(`הכנת העדפות הכרטיס נכשלה: ${preferencesError.message}`);
  }
  return data.id as string;
}

async function openPersonalStep(page: Page) {
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: PERSONAL_STEP, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: PERSONAL_STEP }),
  ).toBeVisible();
}

/** הצ'יפים של "שפות נוספות" (בכרטיס אשה: "שפות נוספות שדוברת") */
function languageChips(page: Page): Locator {
  return page
    .getByText("שפות נוספות שדוברת", { exact: true })
    .locator("xpath=..");
}

test("ממלאים שפות בטופס העריכה, והן מוצגות בכרטיס", async ({ page }) => {
  test.setTimeout(SLOW_TEST_TIMEOUT_MS);

  // Arrange
  const id = await seedEditableCard();
  await page.goto(`/app/students/${id}/edit`);
  await openPersonalStep(page);

  // Act
  await page.getByLabel("שפת אם").selectOption("אחר");
  await page.getByLabel("איזו שפת אם?").fill("פרסית");
  const chips = languageChips(page);
  await chips.getByRole("button", { name: "אנגלית", exact: true }).click();
  await chips.getByRole("button", { name: "אחר", exact: true }).click();
  await page.getByLabel("אילו שפות נוספות?").fill("יוונית");
  await page.getByRole("button", { name: SAVE_BUTTON, exact: true }).click();
  await expect(page.getByText("השינויים נשמרו בהצלחה!")).toBeVisible({
    timeout: SAVE_TIMEOUT_MS,
  });

  // Assert
  expect(await stored(id)).toEqual({
    native_language: "פרסית",
    languages: ["אנגלית", "יוונית"],
  });
  await page.goto(`/app/students/${id}`);
  const nativeTag = page
    .getByText("שפת אם", { exact: true })
    .locator("xpath=..");
  await expect(nativeTag).toContainText("פרסית");
  const languagesTag = page
    .getByText("שפות נוספות", { exact: true })
    .locator("xpath=..");
  await expect(languagesTag).toContainText("אנגלית, יוונית");
});
