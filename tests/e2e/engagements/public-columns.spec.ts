import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientAs } from "../chats/context-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";

/**
 * מודעת אירוסין מפורסמת קריאה לכל אחד, אבל רק בעמודות המודעה עצמה: פרטי
 * הקשר של השולח ומזהי השידוך/הכרטיסים סגורים ל-anon ול-authenticated. המנהל
 * רואה הכול דרך admin_list_engagements.
 */
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ??
  "playwright-admin@kol-mitzhalot.test";
const PUBLIC_SELECT = "id, groom_name, bride_name, groom_city, shadchan_name";
const HIDDEN_COLUMNS = [
  "submitter_name",
  "submitter_phone",
  "submitter_email",
  "shidduch_id",
  "groom_student_id",
  "bride_student_id",
] as const;

test.describe("מודעות מאורסים - עמודות ציבוריות", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let engagementId: string;
  const groomName = `חתן עמודות ${Date.now()}`;

  test.beforeAll(async () => {
    service = createServiceClient();
    anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await service
      .from("engagements")
      .insert({
        groom_name: groomName,
        bride_name: "כלה עמודות",
        groom_city: "בני ברק",
        is_published: true,
        source: "admin",
        submitter_name: "שולח",
        submitter_phone: "0501234567",
        submitter_email: "sender@example.test",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`הכנת מודעה: ${error?.message}`);
    engagementId = data.id as string;
  });

  test.afterAll(async () => {
    await service.from("engagements").delete().eq("id", engagementId);
  });

  test("האתר הציבורי עדיין מונה מודעות מפורסמות", async () => {
    // Act
    const { data, error } = await anon
      .from("engagements")
      .select(PUBLIC_SELECT)
      .eq("is_published", true)
      .eq("id", engagementId);

    // Assert
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].groom_name).toBe(groomName);
  });

  for (const column of HIDDEN_COLUMNS) {
    test(`anon לא קורא את ${column} של מודעה מפורסמת`, async () => {
      // Act
      const { data, error } = await anon
        .from("engagements")
        .select(column)
        .eq("id", engagementId);

      // Assert
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  }

  test("select(*) של anon נכשל במקום להחזיר פרטי קשר", async () => {
    // Act
    const { data, error } = await anon
      .from("engagements")
      .select("*")
      .eq("id", engagementId);

    // Assert
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  test("משתמש מחובר רגיל לא קורא את submitter_phone", async () => {
    // Arrange
    const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
    const email = users?.users.find(
      (u) => u.email === "playwright-card-manager@kol-mitzhalot.test",
    )?.email;
    test.skip(!email, "משתמש הבדיקה לא קיים");
    const client = await clientAs(service, email!);

    // Act
    const { error } = await client
      .from("engagements")
      .select("submitter_phone")
      .eq("id", engagementId);
    const rpc = await client.rpc("admin_list_engagements");

    // Assert
    expect(error).not.toBeNull();
    expect(rpc.error).not.toBeNull();
  });

  test("מנהל רואה את כל השדות דרך admin_list_engagements", async () => {
    // Arrange
    const adminClient = await clientAs(service, ADMIN_EMAIL);

    // Act
    const { data, error } = await adminClient.rpc("admin_list_engagements");

    // Assert
    expect(error).toBeNull();
    const row = (data as Record<string, unknown>[]).find(
      (r) => r.id === engagementId,
    );
    expect(row?.submitter_phone).toBe("0501234567");
    expect(row?.submitter_email).toBe("sender@example.test");
    expect(row?.source).toBe("admin");
  });

  test("הטופס הציבורי עדיין מכניס מודעה לא מפורסמת", async () => {
    // Act
    const { error } = await anon.from("engagements").insert({
      groom_name: `${groomName} טופס`,
      bride_name: "כלה טופס",
      is_published: false,
      source: "public_form",
      submitter_name: "x",
      submitter_phone: "0500000000",
    });

    // Assert
    expect(error).toBeNull();
    await service.from("engagements").delete().eq("groom_name", `${groomName} טופס`);
  });
});
