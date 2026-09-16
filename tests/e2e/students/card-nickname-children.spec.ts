import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * הדר כרטיס המיועד: הכינוי בסוגריים אחרי השם הפרטי - באותו ניסוח של טבלת
 * המיועדים - ומספר הילדים מנישואים קודמים צמוד לסטטוס ("גרוש + 2"), כדי
 * שהוא ייראה בלי לגלול למקטע "נישואין קודמים".
 */
const META = '[data-slot="student-card-meta"]';
const RUN_ID = Date.now();
const LAST_NAME = `הדר${RUN_ID}`;
const NICKNAME = "מוישי";
const CHILDREN = [
  {
    gender: "male",
    birth_date: "2015-04-04",
    lives_with: "student",
    is_married: false,
  },
  {
    gender: "female",
    birth_date: "2017-06-06",
    lives_with: "other_parent",
    is_married: false,
  },
];

const admin = createServiceClient();
let divorcedId: string;
let singleId: string;

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const base = {
    user_id: userId,
    last_name: LAST_NAME,
    gender: "male",
    country: "ישראל",
    city: "בני ברק",
    in_shidduchim: true,
  };

  const { data, error } = await admin
    .from("students")
    .insert([
      {
        ...base,
        first_name: "משה",
        nickname: NICKNAME,
        birth_date: "1985-05-05",
        personal_status: "divorced",
      },
      {
        ...base,
        first_name: "אהרן",
        nickname: null,
        birth_date: "1998-08-08",
        personal_status: "single",
      },
    ])
    .select("id, personal_status");
  if (error || !data) {
    throw new Error(`יצירת כרטיסי הבדיקה נכשלה: ${error?.message}`);
  }
  divorcedId = data.find((row) => row.personal_status === "divorced")
    ?.id as string;
  singleId = data.find((row) => row.personal_status === "single")?.id as string;

  const partner = await admin.from("previous_partners").insert({
    student_id: divorcedId,
    separation_type: "divorce",
    full_name: "שם קודם",
    children: CHILDREN,
    children_number: CHILDREN.length,
  });
  if (partner.error) {
    throw new Error(`הוספת הנישואים הקודמים נכשלה: ${partner.error.message}`);
  }
});

test.afterAll(async () => {
  const ids = [divorcedId, singleId].filter(Boolean);
  if (ids.length > 0) await admin.from("students").delete().in("id", ids);
});

test("הכינוי בכותרת ומספר הילדים ליד הסטטוס", async ({ page }) => {
  // Arrange
  await page.goto(`/app/students/${divorcedId}`);

  // Assert - הכינוי בסוגריים, בדיוק כמו בעמודת השם בטבלה
  await expect(page.locator("h1")).toHaveText(`משה (${NICKNAME}) ${LAST_NAME}`);

  // Assert - הילדים צמודים לסטטוס, ולקורא מסך יש ניסוח מלא
  const meta = page.locator(META);
  await expect(meta).toContainText(`גרוש + ${CHILDREN.length}`);
  await expect(meta).toContainText(`${CHILDREN.length} ילדים`);
});

test("בלי כינוי ובלי ילדים - שם וסטטוס בלבד", async ({ page }) => {
  // Arrange
  await page.goto(`/app/students/${singleId}`);

  // Assert
  await expect(page.locator("h1")).toHaveText(`אהרן ${LAST_NAME}`);
  const meta = page.locator(META);
  await expect(meta).toContainText("רווק");
  await expect(meta).not.toContainText("+");
  await expect(meta).not.toContainText("(");
});
