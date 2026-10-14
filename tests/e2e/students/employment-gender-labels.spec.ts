/**
 * Callers: Playwright `chromium` project (שדכן).
 * ניסוח התעסוקה בכרטיס לפי מגדר בעל הכרטיס: "עובדת" לאישה, "עובד" לגבר;
 * צורה דו-מגדרית ("עובד/ת") רק כשהמגדר לא ידוע. הפונקציות נבדקות ישירות,
 * והכרטיס עצמו בדפדפן.
 */
import { expect, test } from "@playwright/test";

import {
  employmentCategoryToHebrew,
  employmentCompactLabel,
} from "../../../features/students/lib/profile-labels";
import { approvedCard } from "../helpers/approved-card";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

test.describe("employmentCategoryToHebrew", () => {
  test("גבר: צורות זכר", () => {
    expect(employmentCategoryToHebrew("working", "male")).toBe("עובד");
    expect(employmentCategoryToHebrew("yeshiva", "male")).toBe("לומד בישיבה");
    expect(employmentCategoryToHebrew("havruta", "male")).toBe(
      "לומד עם חברותא",
    );
    expect(employmentCategoryToHebrew("profession", "male")).toBe("לומד מקצוע");
  });

  test("אישה: צורות נקבה", () => {
    expect(employmentCategoryToHebrew("working", "female")).toBe("עובדת");
    expect(employmentCategoryToHebrew("yeshiva", "female")).toBe(
      "לומדת בישיבה",
    );
    expect(employmentCategoryToHebrew("havruta", "female")).toBe(
      "לומדת עם חברותא",
    );
    expect(employmentCategoryToHebrew("profession", "female")).toBe(
      "לומדת מקצוע",
    );
    expect(employmentCategoryToHebrew("seminar", "female")).toBe(
      "תלמידת סמינר",
    );
    expect(employmentCategoryToHebrew("at_home", "female")).toBe("בבית");
  });

  test("מגדר לא ידוע: צורה דו-מגדרית", () => {
    for (const gender of [undefined, null, ""]) {
      expect(employmentCategoryToHebrew("working", gender)).toBe("עובד/ת");
      expect(employmentCategoryToHebrew("profession", gender)).toBe(
        "לומד/ת מקצוע",
      );
      expect(employmentCategoryToHebrew("havruta", gender)).toBe(
        "לומד/ת עם חברותא",
      );
      expect(employmentCategoryToHebrew("yeshiva", gender)).toBe(
        "לומד/ת בישיבה",
      );
    }
  });

  test("קטגוריה לא מוכרת מוחזרת כמות שהיא", () => {
    expect(employmentCategoryToHebrew("mystery", "female")).toBe("mystery");
  });
});

test.describe("employmentCompactLabel", () => {
  test("הניסוח המקוצר נכון לשני המגדרים, וחברותא לאישה בנקבה", () => {
    expect(employmentCompactLabel("working", "male")).toBe("עובד");
    expect(employmentCompactLabel("working", "female")).toBe("עובדת");
    expect(employmentCompactLabel("havruta", "female")).toBe("לומדת עם חברותא");
    expect(employmentCompactLabel("yeshiva", "male")).toBe("בחור ישיבה");
    expect(employmentCompactLabel("kolel", "male")).toBe("כולל");
    expect(employmentCompactLabel("seminar", "female")).toBe("לומדת בסמינר");
    expect(employmentCompactLabel(undefined, "male")).toBe("");
    expect(employmentCompactLabel("mystery", "male")).toBe("");
  });
});

test.describe("כרטיס: סעיף התעסוקה", () => {
  const admin = createServiceClient();
  const studentIds: string[] = [];

  async function seedCard(
    gender: "male" | "female",
    categories: string[],
  ): Promise<string> {
    const userId = await getTestUserId(admin);
    const { data, error } = await admin
      .from("students")
      .insert(
        approvedCard({
          user_id: userId,
          first_name: "תעסוקה",
          last_name: `${gender}${Date.now()}`,
          birth_date: "1998-01-01",
          gender,
          personal_status: "single",
          country: "ישראל",
          city: "בני ברק",
          in_shidduchim: true,
        }),
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(`זריעה נכשלה: ${error?.message}`);
    const id = data.id as string;
    studentIds.push(id);
    const { error: jobsError } = await admin.from("employment_history").insert(
      categories.map((category) => ({
        student_id: id,
        category,
        role: null,
      })),
    );
    if (jobsError) throw new Error(`זריעת תעסוקה נכשלה: ${jobsError.message}`);
    return id;
  }

  test.afterAll(async () => {
    if (studentIds.length > 0) {
      await admin.from("students").delete().in("id", studentIds);
    }
  });

  test("כרטיס אישה: 'עובדת' ו'לומדת מקצוע', בלי צורות זכר", async ({
    page,
  }) => {
    // Arrange
    const id = await seedCard("female", ["working", "profession"]);

    // Act
    await page.goto(`/app/students/${id}`);
    const section = page.locator("section", { hasText: "תעסוקה" }).last();

    // Assert
    await expect(section.getByText("עובדת", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      section.getByText("לומדת מקצוע", { exact: true }),
    ).toBeVisible();
    await expect(section.getByText("עובד", { exact: true })).toHaveCount(0);
    await expect(section.getByText("לומד מקצוע", { exact: true })).toHaveCount(
      0,
    );
  });

  test("כרטיס גבר: 'עובד' ו'לומד עם חברותא'", async ({ page }) => {
    // Arrange
    const id = await seedCard("male", ["working", "havruta"]);

    // Act
    await page.goto(`/app/students/${id}`);
    const section = page.locator("section", { hasText: "תעסוקה" }).last();

    // Assert
    await expect(section.getByText("עובד", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      section.getByText("לומד עם חברותא", { exact: true }),
    ).toBeVisible();
  });
});
