/**
 * Callers: Playwright `marketing` project (API בלבד, בלי דפדפן).
 * "אימייל ליצירת קשר" ב-system_settings: אנונימי קורא רק אותו (דרך הפונקציה
 * הצרה), לא את שאר ההגדרות, ואינו כותב; גם משתמש מחובר רגיל אינו כותב.
 */
import { expect, test } from "@playwright/test";

import {
  PLAIN_USER,
  anonClient,
  serviceClient,
  signedInClient,
} from "../helpers/dedications";

const KEY = "contact_email";
const EMAIL = `rls-${Date.now()}@kol-mitzhalot.test`;
const POSTGRES_INSUFFICIENT_PRIVILEGE = "42501";

test.describe("אימייל ליצירת קשר - הרשאות", () => {
  let previous: { text_value: string | null } | null = null;

  test.beforeAll(async () => {
    const service = serviceClient();
    const { data } = await service
      .from("system_settings")
      .select("text_value")
      .eq("key", KEY)
      .maybeSingle();
    previous = data;
    const { error } = await service
      .from("system_settings")
      .upsert({ key: KEY, text_value: EMAIL });
    if (error) throw new Error(`זריעת ההגדרה נכשלה: ${error.message}`);
  });

  test.afterAll(async () => {
    const service = serviceClient();
    if (previous?.text_value) {
      await service
        .from("system_settings")
        .upsert({ key: KEY, text_value: previous.text_value });
    } else {
      await service.from("system_settings").delete().eq("key", KEY);
    }
  });

  test("אנונימי קורא את האימייל דרך הפונקציה הציבורית", async () => {
    const { data, error } = await anonClient().rpc("get_contact_email");

    expect(error).toBeNull();
    expect(data).toBe(EMAIL);
  });

  test("אנונימי לא קורא את הטבלה עצמה (שאר ההגדרות סגורות)", async () => {
    const { data, error } = await anonClient()
      .from("system_settings")
      .select("key, value, text_value");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("אנונימי לא כותב ולא מוחק", async () => {
    const anon = anonClient();

    const insert = await anon
      .from("system_settings")
      .upsert({ key: KEY, text_value: "hacker@example.com" });
    const remove = await anon.from("system_settings").delete().eq("key", KEY);

    expect(insert.error?.code).toBe(POSTGRES_INSUFFICIENT_PRIVILEGE);
    const { data } = await anonClient().rpc("get_contact_email");
    expect(data).toBe(EMAIL);
    // מחיקה ללא מדיניות: לא נכשלת, אבל גם לא מוחקת
    expect(remove.error).toBeNull();
  });

  test("משתמש מחובר רגיל לא משנה ולא מוחק את ההגדרה", async () => {
    const client = await signedInClient(PLAIN_USER);

    const update = await client
      .from("system_settings")
      .update({ text_value: "hacker@example.com" })
      .eq("key", KEY)
      .select();
    const insert = await client
      .from("system_settings")
      .insert({ key: "contact_email_2", text_value: "x@example.com" });
    const remove = await client.from("system_settings").delete().eq("key", KEY);

    expect(update.data ?? []).toEqual([]);
    expect(insert.error?.code).toBe(POSTGRES_INSUFFICIENT_PRIVILEGE);
    expect(remove.error).toBeNull();
    const { data } = await anonClient().rpc("get_contact_email");
    expect(data).toBe(EMAIL);
  });

  test("אורך הערך מוגבל ב-DB (254 תווים)", async () => {
    const { error } = await serviceClient()
      .from("system_settings")
      .upsert({ key: KEY, text_value: `${"a".repeat(250)}@b.co` });

    expect(error?.code).toBe("23514");
  });
});
