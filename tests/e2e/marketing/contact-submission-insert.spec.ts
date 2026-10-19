/**
 * Callers: Playwright `marketing` project (בלי סשן).
 * הטופס הציבורי ממשיך לעבוד אחרי שהפעולה מייצרת בעצמה את מזהה הפנייה
 * (לקישור במייל למנהלים): השורה נשמרת עם מזהה תקין וסטטוס "חדש", והלקוח
 * האנונימי עדיין אינו יכול לקרוא פניות.
 */
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { anonClient, serviceClient } from "../helpers/dedications";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOAD = { timeout: 15_000 };

test.describe("טופס צור קשר - מזהה שנוצר בשרת", () => {
  const emails: string[] = [];

  test.afterAll(async () => {
    if (emails.length) {
      await serviceClient()
        .from("contact_submissions")
        .delete()
        .in("email", emails);
    }
  });

  test("שליחה מהטופס נשמרת עם מזהה תקין וסטטוס חדש", async ({ page }) => {
    // Arrange
    const email = `contact-id-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    await page.goto("/contact");
    const form = page.locator("#contact form");

    // Act
    await form.getByLabel("שם").fill("בדיקת מזהה");
    await form.getByLabel("מייל").fill(email);
    await form.getByLabel("נושא").fill("בדיקת התראה למנהלים");
    await form.getByLabel("הודעה").fill("פנייה לבדיקת E2E בלבד.");
    await form.getByRole("button", { name: "שליחה" }).click();

    // Assert
    await expect(page.getByText("הפנייה נשלחה בהצלחה!")).toBeVisible(LOAD);
    const { data } = await serviceClient()
      .from("contact_submissions")
      .select("id, status, type")
      .eq("email", email);
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toMatch(UUID_PATTERN);
    expect(data?.[0]).toMatchObject({ status: "new", type: "contact" });
  });

  test("אנונימי מוסיף פנייה עם מזהה משלו אך אינו קורא פניות", async () => {
    // Arrange
    const id = randomUUID();
    const email = `contact-anon-${id.slice(0, 8)}@example.com`;
    emails.push(email);
    const anon = anonClient();

    // Act
    const { error } = await anon.from("contact_submissions").insert({
      id,
      type: "contact",
      name: "אנונימי",
      email,
      subject: "s",
      message: "m",
      status: "new",
    });
    const { data: visible } = await anon
      .from("contact_submissions")
      .select("id")
      .eq("id", id);
    const { error: repliedError } = await anon
      .from("contact_submissions")
      .insert({
        type: "contact",
        name: "אנונימי",
        email,
        status: "replied",
      });

    // Assert
    expect(error).toBeNull();
    expect(visible ?? []).toHaveLength(0);
    expect(repliedError).not.toBeNull();
    const { data: stored } = await serviceClient()
      .from("contact_submissions")
      .select("id")
      .eq("id", id);
    expect(stored).toHaveLength(1);
  });
});
