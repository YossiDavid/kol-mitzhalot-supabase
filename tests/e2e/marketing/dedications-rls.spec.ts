/**
 * Callers: Playwright `marketing` project (API בלבד, בלי דפדפן).
 * RLS והאילוצים של public.dedications עם סשנים אמיתיים: אנונימי ומשתמש רגיל
 * רואים רק קוביות מפורסמות ובתוקף היום (שעון ישראל) ואינם כותבים; מנהל עושה
 * הכול; ה-CHECK דוחים תאריכים וטקסטים לא תקינים.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_USER,
  PLAIN_USER,
  addDays,
  anonClient,
  deleteDedicationsByPrefix,
  israelToday,
  seedDedications,
  serviceClient,
  signedInClient,
  type SeedRow,
} from "../helpers/dedications";

const RUN = `rls${Date.now()}`;
const PREFIX = `בדיקת RLS ${RUN}`;
const POSTGRES_CHECK_VIOLATION = "23514";
const POSTGRES_INSUFFICIENT_PRIVILEGE = "42501";

const today = israelToday();
const name = (suffix: string) => `${PREFIX} ${suffix}`;

/** שורות הזריעה: מה שצריך להיראות לציבור מסומן ב-visible */
const SEEDS: ReadonlyArray<SeedRow & { visible: boolean }> = [
  {
    visible: true,
    kind: "sponsor_day",
    honoree: name("היום"),
    starts_on: today,
    ends_on: today,
  },
  {
    visible: true,
    kind: "sponsor_week",
    honoree: name("מסתיים היום"),
    starts_on: addDays(today, -3),
    ends_on: today,
  },
  {
    visible: true,
    kind: "memorial",
    honoree: name("פתוחה"),
    starts_on: addDays(today, -30),
    ends_on: null,
  },
  {
    visible: false,
    kind: "sponsor_day",
    honoree: name("לא מפורסמת"),
    starts_on: today,
    ends_on: today,
    is_published: false,
  },
  {
    visible: false,
    kind: "sponsor_day",
    honoree: name("עתידית"),
    starts_on: addDays(today, 1),
    ends_on: addDays(today, 2),
  },
  {
    visible: false,
    kind: "sponsor_day",
    honoree: name("שהסתיימה אתמול"),
    starts_on: addDays(today, -4),
    ends_on: addDays(today, -1),
  },
  {
    visible: false,
    kind: "memorial",
    honoree: name("הנצחה עתידית פתוחה"),
    starts_on: addDays(today, 5),
    ends_on: null,
  },
];

const visibleNames = SEEDS.filter((seed) => seed.visible).map(
  (seed) => seed.honoree,
);
const allNames = SEEDS.map((seed) => seed.honoree);

async function namesVisibleTo(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from("dedications")
    .select("honoree")
    .like("honoree", `${PREFIX}%`);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.honoree as string).sort();
}

async function existsInDb(honoree: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from("dedications")
    .select("id")
    .eq("honoree", honoree);
  return (data ?? []).length > 0;
}

test.describe("הקדשות: RLS והרשאות", () => {
  let plain: SupabaseClient;
  let admin: SupabaseClient;
  let targetId: string;

  test.beforeAll(async () => {
    await deleteDedicationsByPrefix(PREFIX);
    const ids = await seedDedications(
      SEEDS.map(({ visible: _visible, ...row }) => row),
    );
    targetId = ids[0];
    plain = await signedInClient(PLAIN_USER);
    admin = await signedInClient(ADMIN_USER);
  });

  test.afterAll(async () => {
    await deleteDedicationsByPrefix(PREFIX);
  });

  test("אנונימי רואה רק מפורסמות ובתוקף היום (כולל הנצחה פתוחה ויום אחרון)", async () => {
    expect(await namesVisibleTo(anonClient())).toEqual(
      [...visibleNames].sort(),
    );
  });

  test("משתמש רגיל רואה בדיוק מה שהאנונימי רואה", async () => {
    expect(await namesVisibleTo(plain)).toEqual([...visibleNames].sort());
  });

  test("מנהל רואה את כל השורות, גם לא מפורסמות, עתידיות ושעברו", async () => {
    expect(await namesVisibleTo(admin)).toEqual([...allNames].sort());
  });

  test("אנונימי לא יכול לקרוא עמודות פנימיות (created_by, is_published)", async () => {
    const { error } = await anonClient()
      .from("dedications")
      .select("created_by")
      .limit(1);
    expect(error?.code).toBe(POSTGRES_INSUFFICIENT_PRIVILEGE);
    const { error: publishedError } = await anonClient()
      .from("dedications")
      .select("is_published")
      .limit(1);
    expect(publishedError?.code).toBe(POSTGRES_INSUFFICIENT_PRIVILEGE);
  });

  test("אנונימי לא יכול לכתוב", async () => {
    const { error } = await anonClient()
      .from("dedications")
      .insert({
        kind: "memorial",
        honoree: name("אנונימי"),
        starts_on: today,
      });
    expect(error).not.toBeNull();
    expect(await existsInDb(name("אנונימי"))).toBe(false);
  });

  test("משתמש רגיל לא יכול להוסיף, לעדכן או למחוק", async () => {
    // הוספה
    const insert = await plain.from("dedications").insert({
      kind: "memorial",
      honoree: name("משתמש רגיל"),
      starts_on: today,
    });
    expect(insert.error).not.toBeNull();
    expect(await existsInDb(name("משתמש רגיל"))).toBe(false);

    // עדכון: RLS מסנן את השורה, אין שגיאה אך אין שינוי
    await plain.from("dedications").update({ note: "נפרץ" }).eq("id", targetId);
    const { data: afterUpdate } = await serviceClient()
      .from("dedications")
      .select("note")
      .eq("id", targetId)
      .single();
    expect(afterUpdate?.note).toBeNull();

    // מחיקה
    await plain.from("dedications").delete().eq("id", targetId);
    expect(await existsInDb(name("היום"))).toBe(true);
  });

  test("מנהל יכול להוסיף, לעדכן ולמחוק; created_by מתמלא מהסשן", async () => {
    const created = await admin
      .from("dedications")
      .insert({
        kind: "sponsor_month",
        dedication_type: "לזכות",
        honoree: name("מנהל"),
        starts_on: today,
        ends_on: addDays(today, 29),
      })
      .select("id, created_by, is_published")
      .single();
    expect(created.error).toBeNull();
    expect(created.data?.created_by).not.toBeNull();
    expect(created.data?.is_published).toBe(false); // ברירת מחדל: לא מפורסם

    const updated = await admin
      .from("dedications")
      .update({ is_published: true, note: "עודכן" })
      .eq("id", created.data!.id)
      .select("note, updated_at, created_at")
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data?.note).toBe("עודכן");
    expect(new Date(updated.data!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(updated.data!.created_at).getTime(),
    );

    // מכאן הוא ציבורי: מפורסם ובתוקף
    expect(await namesVisibleTo(anonClient())).toContain(name("מנהל"));

    const deleted = await admin
      .from("dedications")
      .delete()
      .eq("id", created.data!.id);
    expect(deleted.error).toBeNull();
    expect(await existsInDb(name("מנהל"))).toBe(false);
  });

  test("מנהל לא יכול לזייף created_by (העמודה לא ניתנת לכתיבה)", async () => {
    const { error } = await admin.from("dedications").insert({
      kind: "memorial",
      honoree: name("created_by"),
      starts_on: today,
      created_by: "00000000-0000-0000-0000-000000000000",
    });
    expect(error?.code).toBe(POSTGRES_INSUFFICIENT_PRIVILEGE);
  });

  test.describe("אילוצי נתונים (CHECK)", () => {
    const base = {
      kind: "sponsor_day",
      dedication_type: null,
      starts_on: today,
      ends_on: today,
    };

    const invalidRows: ReadonlyArray<
      readonly [string, Record<string, unknown>]
    > = [
      [
        "סיום לפני התחלה",
        { ...base, honoree: name("סדר"), ends_on: addDays(today, -1) },
      ],
      [
        "פרנס בלי תאריך סיום",
        { ...base, honoree: name("פתוח"), ends_on: null },
      ],
      ["שם ריק", { ...base, honoree: "   " }],
      ["שם ארוך מדי (121)", { ...base, honoree: "א".repeat(121) }],
      [
        "שורת תורם ארוכה מדי",
        { ...base, honoree: name("תורם"), donor_line: "ב".repeat(121) },
      ],
      [
        "הערה ארוכה מדי (201)",
        { ...base, honoree: name("הערה"), note: "ג".repeat(201) },
      ],
      [
        "קישור בהערה",
        { ...base, honoree: name("קישור"), note: "ראו http://evil.example" },
      ],
      ["תג תמונה בשם", { ...base, honoree: name("<img src=x>") }],
      [
        "סוג הקדשה לא מוכר",
        { ...base, honoree: name("סוג"), dedication_type: "לכבוד" },
      ],
      [
        "סוג קובייה לא מוכר",
        { ...base, honoree: name("קוביה"), kind: "sponsor_year" },
      ],
      [
        "סדר תצוגה שלילי",
        { ...base, honoree: name("סדר שלילי"), sort_order: -1 },
      ],
    ];

    for (const [title, row] of invalidRows) {
      test(`נדחה: ${title}`, async () => {
        const { error } = await admin.from("dedications").insert(row);
        expect(error?.code).toBe(POSTGRES_CHECK_VIOLATION);
      });
    }

    test("מותר: הנצחה פתוחה, ושם ב-120 תווים בדיוק", async () => {
      const open = await admin
        .from("dedications")
        .insert({
          kind: "memorial",
          honoree: name("פתוחה תקינה"),
          starts_on: today,
          ends_on: null,
        })
        .select("id")
        .single();
      expect(open.error).toBeNull();

      const longName = `${PREFIX} `.padEnd(120, "ד");
      const long = await admin
        .from("dedications")
        .insert({ ...base, honoree: longName })
        .select("id")
        .single();
      expect(long.error).toBeNull();
    });
  });
});
