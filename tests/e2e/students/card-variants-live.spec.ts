import { expect, test, type Browser, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  ensureSecondParentId,
  insertProposal,
  pageAs,
} from "../chats/context-fixtures";
import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { describeZodIssues } from "../../../lib/describe-zod-issues";
import { studentRowSchemas } from "../../../features/students/lib/student-card-data";
import { SEEDED, deleteCards, seedFullCard } from "./third-party-card-fixtures";
import { approvedCard } from "../helpers/approved-card";

/**
 * כל וריאנט של כרטיס המיועד מול המסד המקומי, דרך הדפים האמיתיים ועם נתונים
 * עשירים: מוכיח שה-schemas של האימות תואמים למה שה-DB מחזיק בפועל, ושכלל
 * הפרטיות של כל וריאנט מתקיים ב-HTML (כולל מטען ה-RSC).
 */
const SECOND_PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const T = `${Date.now()}`.slice(-8);

const GROOM_LAST = `גרום${T}`;
const BRIDE_LAST = `כלה${T}`;
const LEGACY_LAST = `ישן${T}`;
const OTHER_LAST = `שלישי${T}`;

/** ערכים רגישים של החתן: אסור שיופיעו אצל מי שלא נפתחו לו */
const GROOM = {
  phone: "0501234001",
  street: "רחוב-חבוי-4471",
  house: "917",
  cv: `https://example.test/cv-groom-${T}.pdf`,
  fatherPhone: "0502222001",
  fatherEmail: `father-${T}@example.test`,
  motherPhone: "0503333001",
  refRabbiPhone: "0504444001",
  refFriendPhone: "0505555001",
  refFriendEmail: `friend-${T}@example.test`,
  rabbiPhone: "0506666001",
  medical: `הצהרה-רפואית-חבויה-${T}`,
  city: "בית שמש",
  eduName: `ישיבת-לימוד-${T}`,
  eduName2: `ישיבה-קטנה-${T}`,
  refRabbiName: `הרב-ממליץ-${T}`,
  refFriendName: `חבר-ממליץ-${T}`,
  about: `אודות-החתן-${T}`,
};

const NOTICES = ["שגיאה בטעינת הפרופיל", "הכרטיס אינו זמין", "מיועד לא נמצא"];

let admin: SupabaseClient;
let shadchanId: string;
let managerId: string;
let parentBId: string;
let groomId = "";
let brideId = "";
let legacyId = "";
let otherId = "";
let shidduchId = "";
let previousFavorites: unknown = [];

async function mustInsert(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
) {
  const { error } = await admin.from(table).insert(rows);
  if (error) throw new Error(`הזנה ל-${table} נכשלה: ${error.message}`);
}

async function insertCard(row: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert(approvedCard(row))
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת כרטיס נכשלה: ${error?.message}`);
  return data.id as string;
}

async function setFavorites(favorites: string[]) {
  const { error } = await admin.auth.admin.updateUserById(shadchanId, {
    user_metadata: { favorites },
  });
  if (error) throw new Error(`עדכון מועדפים נכשל: ${error.message}`);
}

async function readFavorites(): Promise<string[]> {
  const { data } = await admin.auth.admin.getUserById(shadchanId);
  const value = data.user?.user_metadata?.favorites;
  return Array.isArray(value) ? (value as string[]) : [];
}

async function setDisclosure(shareContact: boolean, shareMedical: boolean) {
  const { error } = await admin
    .from("shidduchim")
    .update({
      share_contact_details: shareContact,
      share_medical_info: shareMedical,
    })
    .eq("id", shidduchId);
  if (error) throw new Error(`עדכון פתיחה נכשל: ${error.message}`);
}

/** הכרטיס מוצג: שם ב-h1, בלי הודעת שגיאה. מחזיר את ה-HTML הגולמי (כולל RSC) */
async function expectCardRendered(
  page: Page,
  lastName: string,
): Promise<string> {
  await expect(
    page.getByRole("heading", { level: 1, name: new RegExp(lastName) }),
  ).toBeVisible({ timeout: 20_000 });
  for (const notice of NOTICES) {
    await expect(page.getByText(notice)).toHaveCount(0);
  }
  const response = await page.request.get(page.url());
  return response.text();
}

async function openAs(
  browser: Browser,
  email: string,
  path: string,
): Promise<Page> {
  const page = await pageAs(browser, admin, email, path);
  await page.goto(path);
  return page;
}

function expectNone(html: string, values: readonly string[]) {
  for (const value of values) {
    const at = html.indexOf(value);
    // הקשר קצר בהודעה, כדי לאתר איפה הערך דלף
    const context = at < 0 ? "" : html.slice(Math.max(0, at - 160), at + 60);
    expect(at, `דלף: ${value} ...${context}`).toBe(-1);
  }
}

test.describe("וריאנטי הכרטיס מול המסד", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    managerId = await ensureCardManagerId(admin);
    parentBId = await ensureSecondParentId(admin);
    await admin
      .from("user_profiles")
      .upsert({ id: managerId, first_name: "Fixture", last_name: "Manager" });
    const { data } = await admin.auth.admin.getUserById(shadchanId);
    previousFavorites = data.user?.user_metadata?.favorites ?? [];

    // החתן: עשיר, כל העמודות מלאות, אמא שנפטרה
    groomId = await insertCard({
      user_id: managerId,
      card_for: "child",
      first_name: "חתן",
      last_name: GROOM_LAST,
      nickname: "חתני",
      birth_date: "1999-04-12",
      gender: "male",
      personal_status: "single",
      height: 178.5,
      phone: GROOM.phone,
      country: "ישראל",
      city: GROOM.city,
      street: GROOM.street,
      house: GROOM.house,
      community: "גור",
      shtible: "שטיבל-מרכזי",
      cellphone_type: "kosher",
      plan_for_life: "torah_job",
      head_cover_type: null,
      cv_url: GROOM.cv,
      about: GROOM.about,
      in_shidduchim: true,
      parents_info: {
        father: {
          self: { prefix: "ר'", name: "יעקב", suffix: "" },
          phone: GROOM.fatherPhone,
          job: "מלמד",
          email: GROOM.fatherEmail,
          grandFather: { prefix: "", name: "", suffix: "" },
          grandMother: { prefix: "", name: "", suffix: "" },
        },
        mother: {
          self: { prefix: "", name: "רחל", suffix: "" },
          maidenName: "כהן",
          phone: GROOM.motherPhone,
          job: "",
          email: "",
        },
        status: "widowed",
        holding: null,
        deadParent: "mother",
        fatherDeathDate: null,
        motherDeathDate: "2015-01-02",
      },
      family_info: {
        numberOfChildren: 6,
        currentChildPlace: 2,
        about: "משפחה-חמה",
        mechutanim: [
          { id: "m1", firstName: "דוד", lastName: "לוי", city: "אשדוד" },
        ],
      },
      author_info: {
        name: "אבא-ממלא",
        phone: "0507777001",
        email: "author-live@example.test",
        relation: "אב",
        relationType: "father",
        knowsWell: true,
        fillReason: "סיבה-ממלא",
      },
    });
    await mustInsert("education_history", [
      {
        student_id: groomId,
        institution_type: "yeshiva_ktana",
        name: GROOM.eduName2,
        community: "גור",
        city: "ירושלים",
      },
      {
        student_id: groomId,
        institution_type: "yeshiva_gdola",
        name: GROOM.eduName,
        community: null,
        city: null,
      },
    ]);
    await mustInsert("employment_history", {
      student_id: groomId,
      category: "working",
      role: "מורה",
      location: "חיידר",
      description: null,
    });
    await mustInsert("partner_preferences", {
      student_id: groomId,
      age_min: 19,
      age_max: 24,
      preferred_countries: ["ישראל"],
      work_status: ["working"],
      head_cover_type: "wig",
      plan_for_life: "torah_job",
      cellphone_type: "kosher",
      about_partner: "מחפש-בת-טובה",
      additional_information: null,
    });
    await mustInsert("previous_partners", {
      student_id: groomId,
      separation_type: "divorce",
      full_name: "בת-זוג-קודמת",
      marriage_date: "2018-01-01",
      divorce_date: "2019-01-01",
      death_date: null,
      children_number: 1,
      children: [
        {
          gender: "male",
          birth_date: "2018-12-01",
          lives_with: "mother",
          is_married: false,
        },
      ],
      no_children: false,
      divorce_details: {
        reason: "סיבה",
        rabbiName: "הרב-המלווה",
        rabbiPhone: GROOM.rabbiPhone,
      },
    });
    await mustInsert("references", [
      {
        student_id: groomId,
        reference_type: "rabbi",
        name: GROOM.refRabbiName,
        phone: GROOM.refRabbiPhone,
        email: null,
      },
      {
        student_id: groomId,
        reference_type: "friend",
        name: GROOM.refFriendName,
        phone: GROOM.refFriendPhone,
        email: GROOM.refFriendEmail,
      },
    ]);
    await mustInsert("medical_records", {
      student_id: groomId,
      status: "littleProblem",
      exposure_level: "basic_exposure",
      details: GROOM.medical,
      documents: [],
      contact_info: { type: "parents" },
      related_issue_preference: null,
    });

    // הכלה: אותן עמודות כשחלק מהאופציונליות NULL
    brideId = await insertCard({
      user_id: parentBId,
      card_for: "self",
      first_name: "כלה",
      last_name: BRIDE_LAST,
      birth_date: "2001-08-30",
      gender: "female",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
      head_cover_type: "kerchief",
      author_info: {},
    });

    // כרטיס ישן: card_for ריק, מחרוזות ריקות ו-JSON חלקי
    legacyId = await insertCard({
      user_id: managerId,
      card_for: null,
      first_name: "ישן",
      last_name: LEGACY_LAST,
      nickname: "",
      birth_date: "1997-02-02",
      gender: "male",
      personal_status: "divorced",
      height: null,
      phone: "",
      country: "ישראל",
      city: "צפת",
      street: "",
      house: "",
      community: "",
      shtible: "",
      cellphone_type: null,
      plan_for_life: null,
      head_cover_type: null,
      about: "",
      in_shidduchim: null,
      parents_info: { father: { self: { name: "אב-ישן" } } },
      family_info: {},
      author_info: { name: "ממלא-ישן", relation: "אב" },
    });
    await mustInsert("references", {
      student_id: legacyId,
      reference_type: "friend",
      name: "ממליץ-ישן",
      phone: "",
      email: "",
    });

    // כרטיס צד שלישי שלא אושר
    otherId = await seedFullCard(admin, {
      ownerId: managerId,
      lastName: OTHER_LAST,
      gender: "female",
      cardFor: "other",
    });

    shidduchId = await insertProposal(admin, {
      groomId,
      brideId,
      shadchanId,
      scope: "both",
    });
  });

  test.afterAll(async () => {
    await admin.from("shidduchim").delete().eq("id", shidduchId);
    await deleteCards(
      admin,
      [groomId, brideId, legacyId, otherId].filter(Boolean),
    );
    await admin.auth.admin.updateUserById(shadchanId, {
      user_metadata: {
        favorites: Array.isArray(previousFavorites) ? previousFavorites : [],
      },
    });
  });

  test("1א. מלא: הבעלים על הכרטיס שלו", async ({ browser }) => {
    const page = await openAs(
      browser,
      CARD_MANAGER_EMAIL,
      `/app/students/${groomId}`,
    );
    await expectCardRendered(page, GROOM_LAST);
    await expect(page.getByText(GROOM.eduName).first()).toBeVisible();
    await expect(page.getByText(GROOM.about)).toBeVisible();
    await expect(page.getByText(GROOM.medical)).toBeVisible();
    await page.context().close();
  });

  test("1ב. מלא: שדכן על כרטיס של אחר, עם טלפון הממליץ", async ({ page }) => {
    await page.goto(`/app/students/${groomId}`);
    await expectCardRendered(page, GROOM_LAST);
    await expect(page.getByText(GROOM.refFriendName)).toBeVisible();
    await expect(
      page.getByRole("link", { name: GROOM.refFriendPhone }),
    ).toBeVisible();
    await expect(page.getByText(GROOM.about)).toBeVisible();
  });

  test("2. הצעה סגורה: כרטיס החתן אצל הורה הכלה, בלי פרטי קשר ורפואי", async ({
    browser,
  }) => {
    await setDisclosure(false, false);
    const page = await openAs(
      browser,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );
    const html = await expectCardRendered(page, GROOM_LAST);
    await expect(page.getByText(GROOM.city).first()).toBeVisible();
    await expect(page.getByText(GROOM.eduName).first()).toBeVisible();
    await expect(page.getByText(GROOM.refRabbiName)).toBeVisible();
    expectNone(html, [
      GROOM.phone,
      GROOM.street,
      GROOM.cv,
      GROOM.fatherPhone,
      GROOM.fatherEmail,
      GROOM.motherPhone,
      GROOM.refRabbiPhone,
      GROOM.refFriendPhone,
      GROOM.refFriendEmail,
      GROOM.rabbiPhone,
      GROOM.medical,
    ]);
    await page.context().close();
  });

  test("3. הצעה עם פרטי התקשרות: טלפונים גלויים, רפואי עדיין לא", async ({
    browser,
  }) => {
    await setDisclosure(true, false);
    const page = await openAs(
      browser,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );
    const html = await expectCardRendered(page, GROOM_LAST);
    await expect(
      page.getByRole("link", { name: GROOM.phone }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: GROOM.refFriendPhone }),
    ).toBeVisible();
    expectNone(html, [GROOM.medical]);
    await page.context().close();
  });

  test("4א. הצעה עם הצהרה רפואית: רפואי גלוי, קשר עדיין לא", async ({
    browser,
  }) => {
    await setDisclosure(false, true);
    const page = await openAs(
      browser,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );
    const html = await expectCardRendered(page, GROOM_LAST);
    await expect(page.getByText(GROOM.medical)).toBeVisible();
    expectNone(html, [
      GROOM.phone,
      GROOM.street,
      GROOM.cv,
      GROOM.fatherPhone,
      GROOM.fatherEmail,
      GROOM.refFriendPhone,
      GROOM.rabbiPhone,
    ]);
    await page.context().close();
  });

  test("4ב. הצעה עם שניהם: קשר ורפואי גלויים", async ({ browser }) => {
    await setDisclosure(true, true);
    const page = await openAs(
      browser,
      SECOND_PARENT_EMAIL,
      `/app/students/${groomId}`,
    );
    await expectCardRendered(page, GROOM_LAST);
    await expect(page.getByText(GROOM.medical)).toBeVisible();
    await expect(
      page.getByRole("link", { name: GROOM.phone }).first(),
    ).toBeVisible();
    await page.context().close();
  });

  test("5. בסיסי: שדכן על כרטיס צד שלישי שלא אושר", async ({ page }) => {
    await page.goto(`/app/students/${otherId}`);
    const html = await expectCardRendered(page, OTHER_LAST);
    await expect(page.getByText(SEEDED.city).first()).toBeVisible();
    await expect(page.getByText(SEEDED.institutionName).first()).toBeVisible();
    expectNone(html, [
      SEEDED.about,
      SEEDED.familyAbout,
      SEEDED.referenceName,
      SEEDED.fatherJob,
      "0501119999",
      SEEDED.partnerAbout,
      SEEDED.previousPartnerName,
    ]);
  });

  test.describe("צופה לא מחובר", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    // טלפון ואימייל של ההורים מוצגים בכרטיס הציבורי בכוונה (parent-card.tsx),
    // ולכן אינם נבדקים כאן; פרטי המיועד עצמו, הרפואי והת.ז. אסורים.
    test("6. אנונימי: כרטיס רגיל בלי קשר, רפואי או ת.ז.", async ({ page }) => {
      await page.goto(`/app/students/${groomId}`);
      const html = await expectCardRendered(page, GROOM_LAST);
      await expect(page.getByText(GROOM.about)).toBeVisible();
      await expect(page.getByText(GROOM.eduName).first()).toBeVisible();
      expectNone(html, [
        GROOM.phone,
        GROOM.street,
        GROOM.cv,
        GROOM.medical,
        GROOM.rabbiPhone,
        "identity_number",
      ]);
    });

    test("7. אנונימי בסיסי: כרטיס צד שלישי שלא אושר", async ({ page }) => {
      await page.goto(`/app/students/${otherId}`);
      const html = await expectCardRendered(page, OTHER_LAST);
      await expect(page.getByText(SEEDED.city).first()).toBeVisible();
      expectNone(html, [
        SEEDED.about,
        SEEDED.familyAbout,
        SEEDED.referenceName,
        SEEDED.fatherJob,
        "0501119999",
        SEEDED.fillReason,
      ]);
    });
  });

  test("8א. כרטיס ישן: הבעלים", async ({ browser }) => {
    const page = await openAs(
      browser,
      CARD_MANAGER_EMAIL,
      `/app/students/${legacyId}`,
    );
    await expectCardRendered(page, LEGACY_LAST);
    await expect(page.getByText("צפת").first()).toBeVisible();
    await page.context().close();
  });

  test("8ב. כרטיס ישן: שדכן", async ({ page }) => {
    await page.goto(`/app/students/${legacyId}`);
    await expectCardRendered(page, LEGACY_LAST);
    await expect(page.getByText("ממליץ-ישן")).toBeVisible();
  });

  test("9א. לוח הבקרה של הבעלים: כל הכרטיסים בטבלה", async ({ browser }) => {
    const page = await openAs(browser, CARD_MANAGER_EMAIL, "/app");
    for (const name of [GROOM_LAST, LEGACY_LAST, OTHER_LAST]) {
      await expect(page.getByText(name).first()).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(page.getByText("שגיאה בטעינה")).toHaveCount(0);
    await page.context().close();
  });

  test("9ב. מועדפי שדכן: הכרטיס העשיר והישן", async ({ page }) => {
    await setFavorites([groomId, legacyId]);
    await page.goto("/app");
    await expect(
      page.getByRole("heading", { name: "המועדפים שלך" }),
    ).toBeVisible();
    await expect(page.getByText(GROOM_LAST).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(LEGACY_LAST).first()).toBeVisible();
    await expect(page.getByText("לא הצלחנו לטעון את המועדפים")).toHaveCount(0);
  });

  test("10. רשימת המיועדים: שדכן רואה את הכרטיס הישן", async ({ page }) => {
    await page.goto("/app/students");
    await page.locator("#search").fill(LEGACY_LAST);
    await expect(page.getByText(LEGACY_LAST).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("לא הצלחנו לטעון")).toHaveCount(0);
  });

  test("11. מועדפים: הוספה מהרשימה, הצגה בלוח, והסרה", async ({ page }) => {
    await setFavorites([]);
    await page.goto("/app/students");
    await page.locator("#search").fill(BRIDE_LAST);
    // הכלה אינה בבעלות השדכן אך נראית לו ברשימה
    // הכוכב של שורת הכלה עצמה: לחיצה על הכוכב הראשון בדף נתפסה לפני שהסינון
    // חל, ועל שורה אחרת
    await page
      .getByRole("row", { name: new RegExp(BRIDE_LAST) })
      .getByRole("button", { name: "הוסף למועדפים" })
      .click();
    await expect.poll(readFavorites).toEqual([brideId]);

    await page.goto("/app");
    await expect(page.getByText(BRIDE_LAST).first()).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole("button", {
        name: new RegExp(`הסר ממועדפים: .*${BRIDE_LAST}`),
      })
      .first()
      .click();
    await expect.poll(readFavorites).toEqual([]);
  });
});

test("כשל אימות נרשם עם נתיב וקוד בלבד, בלי ערכים אישיים", () => {
  // Arrange
  const pii = "0509998877";

  // Act
  const result = studentRowSchemas.full.safeParse({
    id: 5,
    first_name: pii,
    last_name: "משפחה",
    gender: pii,
    phone: 12345,
  });

  // Assert
  expect(result.success).toBe(false);
  const logged = JSON.stringify(
    describeZodIssues(result.success ? [] : result.error.issues),
  );
  expect(logged).toContain("id: invalid_type");
  expect(logged).toContain("gender: invalid_value");
  expect(logged).not.toContain(pii);
  expect(logged).not.toContain("12345");
});
