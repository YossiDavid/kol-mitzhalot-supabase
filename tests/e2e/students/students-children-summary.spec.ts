import { test, expect } from "@playwright/test";

import { summarizeChildren } from "../../../features/students/lib/children-summary";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * שורת הילדים בעמודת הסטטוס ברשימה: מספר ילדים, "ללא ילדים" רק כשסומן
 * במפורש, ושום דבר כשהמידע לא מולא. תלוי בעמודה previous_partners.no_children.
 */

const child = {
  gender: "male",
  birth_date: "2015-01-01",
  lives_with: "student",
  is_married: false,
};

test.describe("summarizeChildren", () => {
  test("ילד אחד", () => {
    expect(summarizeChildren("divorced", [{ children: [child] }])).toBe(
      "ילד אחד",
    );
  });

  test("כמה ילדים, מכל הנישואים", () => {
    expect(
      summarizeChildren("widowed", [
        { children: [child, child] },
        { children: [child] },
      ]),
    ).toBe("3 ילדים");
  });

  test("שורה ישנה עם מספר בלבד", () => {
    expect(
      summarizeChildren("divorced", [{ children: [], children_number: 2 }]),
    ).toBe("2 ילדים");
  });

  test("ללא ילדים כשכל הנישואים סומנו", () => {
    expect(
      summarizeChildren("divorced", [
        { children: [], no_children: true },
        { children: [], no_children: true },
      ]),
    ).toBe("ללא ילדים");
  });

  test("לא מולא - כלום", () => {
    expect(
      summarizeChildren("divorced", [
        { children: [], children_number: 0, no_children: false },
      ]),
    ).toBeNull();
  });

  test("רק חלק מהנישואים סומנו - כלום", () => {
    expect(
      summarizeChildren("divorced", [
        { children: [], no_children: true },
        { children: [], no_children: false },
      ]),
    ).toBeNull();
  });

  test("בלי שורות נישואים - כלום", () => {
    expect(summarizeChildren("divorced", [])).toBeNull();
    expect(summarizeChildren("divorced", null)).toBeNull();
  });

  test("רווק לא מקבל טקסט גם עם שורה ישנה", () => {
    expect(summarizeChildren("single", [{ children: [child] }])).toBeNull();
  });
});

const admin = createServiceClient();
const stamp = Date.now();
const LAST_NAME = `ילדיםברשימה${stamp}`;
const WITH_CHILDREN = `עםילדים${stamp}`;
const NO_CHILDREN = `ללאילדים${stamp}`;
const NOT_FILLED = `לאמולא${stamp}`;

let studentIds: string[] = [];

async function createDivorced(
  userId: string,
  firstName: string,
  partner: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: LAST_NAME,
      birth_date: "1990-01-01",
      gender: "male",
      personal_status: "divorced",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת מיועד נכשלה: ${error?.message}`);

  const { error: partnerError } = await admin
    .from("previous_partners")
    .insert({ student_id: data.id, separation_type: "divorce", ...partner });
  if (partnerError) {
    throw new Error(`יצירת נישואים קודמים נכשלה: ${partnerError.message}`);
  }
  return data.id as string;
}

test.describe("שורת הילדים ברשימה", () => {
  test.beforeAll(async () => {
    const userId = await getTestUserId(admin);
    studentIds = [
      await createDivorced(userId, WITH_CHILDREN, {
        children: [child, { ...child, gender: "female" }],
      }),
      await createDivorced(userId, NO_CHILDREN, { no_children: true }),
      await createDivorced(userId, NOT_FILLED, {}),
    ];
  });

  test.afterAll(async () => {
    await admin.from("previous_partners").delete().in("student_id", studentIds);
    await admin.from("students").delete().in("id", studentIds);
  });

  test("מספר הילדים, ללא ילדים, ושום דבר כשלא מולא", async ({ page }) => {
    // Arrange
    await page.goto("/app/students");
    await page.locator("#search").fill(LAST_NAME);
    const rowOf = (firstName: string) =>
      page
        .locator("tr, li, [role='row']")
        .filter({ hasText: firstName })
        .filter({ visible: true })
        .first();

    // Assert
    await expect(rowOf(WITH_CHILDREN)).toBeVisible({ timeout: 10_000 });
    await expect(
      rowOf(WITH_CHILDREN).getByTestId("children-summary"),
    ).toHaveText(/2 ילדים/);
    await expect(
      rowOf(NO_CHILDREN).getByTestId("children-summary"),
    ).toHaveText(/ללא ילדים/);
    await expect(rowOf(NOT_FILLED)).toBeVisible();
    await expect(rowOf(NOT_FILLED).getByTestId("children-summary")).toHaveCount(
      0,
    );
  });
});
