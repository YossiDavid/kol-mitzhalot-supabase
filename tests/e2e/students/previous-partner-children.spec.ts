import { test, expect, type Locator, type Page } from "@playwright/test";

import calculateAge from "../../../lib/calculateAge";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * ילדים מנישואים קודמים (גרוש/ה, אלמן/ה): רשימה בתוך כל שורת נישואים, עם
 * בן/בת ותאריך לידה חובה. נשמר ב-previous_partners.children, ומספר הילדים
 * נגזר מהרשימה. שורה ישנה עם מספר בלי פרטים שומרת על המספר עד שמוסיפים.
 */

const admin = createServiceClient();
const RUN_ID = Date.now();
const LAST_NAME = `ילדים${RUN_ID}`;
const LEGACY_CHILDREN_COUNT = 3;
const STEP_TITLE = "פרטים נוספים";
// המיועד זכר: שלב "מי שמחפשים" מנוסח לפי המיועדת
const LAST_STEP_TITLE = "קצת על המיועדת שאתם מחפשים";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHILDREN_LIST = "previousPartners.0.children";
// שנים עבריות בבורר התאריכים: תש"ף (2019-2020) ותש"ע (2009-2010)
const FIRST_CHILD_YEAR = "5780";
const SECOND_CHILD_YEAR = "5770";

let studentId: string;

interface StoredChild {
  gender: string;
  birth_date: string;
  lives_with: string | null;
  is_married: boolean;
}

const nameParts = (name: string) => ({ prefix: "", name, suffix: "" });

/** כרטיס של גרוש שעובר את כל שדות החובה בטופס, עם נישואים קודמים ישנים */
async function createDivorcedStudent(): Promise<string> {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "גרוש",
      last_name: LAST_NAME,
      identity_number: String(RUN_ID).slice(-9),
      birth_date: "1985-05-05",
      gender: "male",
      personal_status: "divorced",
      country: "ישראל",
      city: "בני ברק",
      street: "רבי עקיבא",
      house: "10",
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
        numberOfChildren: 5,
        currentChildPlace: 2,
        about: "משפחה תורנית",
        mechutanim: [],
      },
      author_info: { name: "כותב הבדיקה", phone: "0503333333", relation: "אב" },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  const id = data.id as string;

  const related = await Promise.all([
    admin
      .from("partner_preferences")
      .insert({ student_id: id, additional_information: "מחפשים בת תורה" }),
    admin.from("previous_partners").insert({
      student_id: id,
      separation_type: "divorce",
      full_name: "שם קודם",
      children_number: LEGACY_CHILDREN_COUNT,
    }),
  ]);
  const relatedError = related.find((result) => result.error)?.error;
  if (relatedError) {
    throw new Error(`הכנת נתוני הכרטיס נכשלה: ${relatedError.message}`);
  }
  return id;
}

async function readPreviousPartner() {
  const { data, error } = await admin
    .from("previous_partners")
    .select("children_number, children")
    .eq("student_id", studentId)
    .single();
  if (error || !data) {
    throw new Error(`קריאת הנישואים הקודמים נכשלה: ${error?.message}`);
  }
  return data as { children_number: number | null; children: StoredChild[] };
}

async function openPreviousPartnersStep(page: Page) {
  await page.goto(`/app/students/${studentId}/edit`);
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: STEP_TITLE, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: STEP_TITLE })).toBeVisible();
}

async function submitFromLastStep(page: Page) {
  await page
    .getByRole("navigation", { name: "שלבי הטופס" })
    .getByRole("button", { name: LAST_STEP_TITLE, exact: true })
    .click();
  await page.getByRole("button", { name: "שמירת השינויים" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/students/${studentId}$`), {
    timeout: 20_000,
  });
}

const childCell = (page: Page, index: number, field: string): Locator =>
  page.locator(`[data-field-name="${CHILDREN_LIST}.${index}.${field}"]`);

/** בורר התאריכים העברי: פותחים, בוחרים שנה ולוחצים על יום באמצע החודש */
async function pickBirthDate(page: Page, index: number, hebrewYear: string) {
  const cell = childCell(page, index, "birthDate");
  await cell.locator('input[placeholder="בחר תאריך עברי"]').click();
  await cell.locator('select[name="year"]').selectOption(hebrewYear);
  await cell.locator(".grid-cols-7 button").nth(15).click();
  await expect(cell.getByText(/^(גיל \d+|פחות משנה)$/)).toBeVisible();
}

const ageText = (isoDate: string) => {
  const age = Number(calculateAge(isoDate));
  return age < 1 ? "פחות משנה" : `גיל ${age}`;
};

test.describe.serial("ילדים מנישואים קודמים", () => {
  test.beforeAll(async () => {
    studentId = await createDivorcedStudent();
  });

  test.afterAll(async () => {
    if (!studentId) return;
    await admin.from("students").delete().eq("id", studentId);
  });

  test("שורה ישנה: הודעה על ילדים בלי פרטים, והשמירה לא מוחקת את המספר", async ({
    page,
  }) => {
    // Arrange
    await openPreviousPartnersStep(page);
    const childrenList = page.locator(`[data-field-name="${CHILDREN_LIST}"]`);

    // Assert - בטופס
    await expect(
      childrenList.getByText("ילדים מנישואין אלו (0)"),
    ).toBeVisible();
    await expect(
      childrenList.getByText(
        `נרשמו ${LEGACY_CHILDREN_COUNT} ילדים בלי פרטים - אפשר להוסיף את פרטיהם`,
      ),
    ).toBeVisible();

    // Act
    await submitFromLastStep(page);

    // Assert - במסד ובכרטיס
    const partner = await readPreviousPartner();
    expect(partner.children_number).toBe(LEGACY_CHILDREN_COUNT);
    expect(partner.children).toEqual([]);
    await expect(
      page.getByText(`${LEGACY_CHILDREN_COUNT} ילדים`, { exact: true }),
    ).toBeVisible();
  });

  test("הוספת שני ילדים: שגיאות חובה בפריט ריק, שמירה והצגה בכרטיס", async ({
    page,
  }) => {
    // Arrange
    await openPreviousPartnersStep(page);
    await page.getByRole("button", { name: "הוספת ילד/ה" }).click();
    await expect(page.getByText("ילדים מנישואין אלו (1)")).toBeVisible();

    // Act - פריט ריק חוסם את המעבר לשלב הבא
    await page.getByRole("button", { name: "המשך לשלב הבא" }).click();

    // Assert
    await expect(
      childCell(page, 0, "gender").getByText("נא לבחור בן/בת"),
    ).toBeVisible();
    await expect(
      childCell(page, 0, "birthDate").getByText("נא לבחור תאריך לידה"),
    ).toBeVisible();
    await expect(
      childCell(page, 0, "gender").getByRole("radio", { name: "בן" }),
    ).toBeFocused();
    await expect(page.getByRole("heading", { name: STEP_TITLE })).toBeVisible();

    // Act - מילוי שני ילדים
    await childCell(page, 0, "gender")
      .getByRole("radio", { name: "בן" })
      .check();
    await pickBirthDate(page, 0, FIRST_CHILD_YEAR);
    await childCell(page, 0, "livesWith")
      .locator("select")
      .selectOption("other_parent");

    await page.getByRole("button", { name: "הוספת ילד/ה" }).click();
    await childCell(page, 1, "gender")
      .getByRole("radio", { name: "בת" })
      .check();
    await pickBirthDate(page, 1, SECOND_CHILD_YEAR);
    await childCell(page, 1, "isMarried")
      .getByRole("checkbox", { name: "נשוי/אה" })
      .check();

    await expect(page.getByText("ילדים מנישואין אלו (2)")).toBeVisible();
    // שגיאות החובה נעלמות כשהערך מולא, בלי ללחוץ שוב על "המשך"
    await expect(page.getByText("נא לבחור בן/בת")).toHaveCount(0);
    await expect(page.getByText("נא לבחור תאריך לידה")).toHaveCount(0);
    await expect(page.getByText(/נרשמו \d+ ילדים בלי פרטים/)).toHaveCount(0);

    await submitFromLastStep(page);

    // Assert - במסד
    const partner = await readPreviousPartner();
    expect(partner.children_number).toBe(2);
    expect(partner.children).toHaveLength(2);
    const [son, daughter] = partner.children;
    expect(son).toMatchObject({
      gender: "male",
      lives_with: "other_parent",
      is_married: false,
    });
    expect(daughter).toMatchObject({
      gender: "female",
      lives_with: null,
      is_married: true,
    });
    expect(son.birth_date).toMatch(ISO_DATE);
    expect(daughter.birth_date).toMatch(ISO_DATE);
    expect(son.birth_date > daughter.birth_date).toBe(true);

    // Assert - בכרטיס, עם הגיל שמחושב מתאריך הלידה
    await expect(page.getByText("2 ילדים", { exact: true })).toBeVisible();
    await expect(
      page.getByText(`בן · ${ageText(son.birth_date)} · גר אצל האם`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(`בת · ${ageText(daughter.birth_date)} · נשואה`, {
        exact: true,
      }),
    ).toBeVisible();
  });
});
