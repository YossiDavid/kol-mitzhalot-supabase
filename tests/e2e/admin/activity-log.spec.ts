import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CARD_MANAGER_EMAIL, clientAs } from "../chats/context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * יומן הפעילות: טריגרים רושמים פעולות מהותיות על כרטיסים והצעות (בלי שורת
 * הנתונים המלאה), הקריאה למנהל בלבד, ואין כתיבה מהלקוח. הדף בניהול מציג,
 * מסנן ומקושר מתפריט הניהול.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const ACTIVITY_PATH = "/app/admin/activity";
const ADMIN_NAV_LINKS_SCOPE =
  '[data-testid="admin-sidebar-nav"], [data-testid^="admin-flyout-"]';

type LogRow = {
  action: string;
  actor_id: string | null;
  summary: string;
  details: Record<string, unknown>;
};

test.describe("יומן פעילות", () => {
  test.describe.configure({ mode: "serial" });

  let svc: SupabaseClient;
  let adminClient: SupabaseClient;
  let shadchanClient: SupabaseClient;
  let parentClient: SupabaseClient;
  let adminId: string;
  let shadchanId: string;
  let fx: ShidduchFixtures;

  const logFor = async (entityId: string): Promise<LogRow[]> => {
    const { data, error } = await svc
      .from("activity_log")
      .select("action, actor_id, summary, details")
      .eq("entity_id", entityId)
      .order("at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as LogRow[];
  };

  test.beforeAll(async () => {
    svc = createServiceClient();
    adminId = await getTestUserId(svc, ADMIN_EMAIL);
    shadchanId = await getTestUserId(svc);
    fx = await setupShidduchFixtures(svc);
    adminClient = await clientAs(svc, ADMIN_EMAIL);
    shadchanClient = await clientAs(svc, TEST_USER_EMAIL);
    parentClient = await clientAs(svc, CARD_MANAGER_EMAIL);
  });

  test.afterAll(async () => {
    await svc
      .from("activity_log")
      .delete()
      .in("entity_id", [
        fx.groomFirst,
        fx.groomSecond,
        fx.brideFirst,
        fx.brideSecond,
      ]);
    await teardownShidduchFixtures(svc, fx);
  });

  test("טריגרים: יצירת כרטיס, השהיה ושינוי סטטוס - עם המבצע ושמות העמודות בלבד", async () => {
    // Act - השהיה כפי שה-route כותב אותה (service role, admin_paused_by),
    // ושינוי סטטוס אישי ב-service role
    const paused = await svc
      .from("students")
      .update({
        admin_paused_at: new Date().toISOString(),
        admin_paused_by: adminId,
        in_shidduchim: false,
      })
      .eq("id", fx.groomSecond);
    expect(paused.error).toBeNull();
    await svc
      .from("students")
      .update({ personal_status: "engaged" })
      .eq("id", fx.brideSecond);

    // Assert
    const groomLog = await logFor(fx.groomSecond);
    expect(groomLog.map((row) => row.action)).toEqual([
      "student.created",
      "student.paused",
    ]);
    expect(groomLog[1].actor_id).toBe(adminId);
    expect(groomLog[1].details.changed).toEqual(
      expect.arrayContaining(["admin_paused_at", "in_shidduchim"]),
    );
    // בלי שורת הכרטיס המלאה ביומן
    expect(JSON.stringify(groomLog[1].details)).not.toContain("בני ברק");

    const brideLog = await logFor(fx.brideSecond);
    expect(brideLog.at(-1)?.action).toBe("student.personal_status");
    expect(brideLog.at(-1)?.details.personal_status).toEqual({
      from: "single",
      to: "engaged",
    });
  });

  test("טריגרים: הצעה נוצרה ושינוי סטטוס, עם המבצע", async () => {
    // Act - טיוטה של השדכן בסשן שלו, ושינוי סטטוס דרך ה-RPC של ה-route
    const { data: draft, error } = await shadchanClient
      .from("shidduchim")
      .insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideFirst,
        shadchan_id: shadchanId,
        status: "draft",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const status = await svc.rpc("set_shidduch_status_as", {
      p_shidduch_id: draft!.id,
      p_status: "rejected",
      p_actor: adminId,
    });
    expect(status.error).toBeNull();

    // Assert
    const log = await logFor(draft!.id);
    expect(log.map((row) => row.action)).toEqual([
      "shidduch.created",
      "shidduch.status",
    ]);
    expect(log[0].actor_id).toBe(shadchanId);
    expect(log[0].summary).toBe("מיועד ראשון - מיועדת ראשונה");
    expect(log[1].actor_id).toBe(adminId);
    expect(log[1].details).toMatchObject({
      status_from: "draft",
      status_to: "rejected",
    });
  });

  test("גישה: מנהל קורא; שדכן, הורה ואנונימי לא קוראים; אף לקוח לא כותב", async () => {
    // Act
    const asAdmin = await adminClient
      .from("activity_log")
      .select("id")
      .eq("entity_id", fx.groomSecond);
    const asShadchan = await shadchanClient.from("activity_log").select("id");
    const asParent = await parentClient.from("activity_log").select("id");
    const insertAsAdmin = await adminClient.from("activity_log").insert({
      action: "fake",
      entity_type: "student",
      summary: "ניסיון כתיבה",
    });
    const insertAsShadchan = await shadchanClient.from("activity_log").insert({
      action: "fake",
      entity_type: "student",
      summary: "ניסיון כתיבה",
    });
    const rpcAsShadchan = await shadchanClient.rpc("activity_record", {
      p_actor: shadchanId,
      p_action: "fake",
      p_entity_type: "student",
      p_entity_id: fx.groomFirst,
      p_summary: "ניסיון",
      p_details: {},
    });

    // Assert
    expect(asAdmin.error).toBeNull();
    expect(asAdmin.data?.length ?? 0).toBeGreaterThan(0);
    expect(asShadchan.data ?? []).toEqual([]);
    expect(asParent.data ?? []).toEqual([]);
    expect(insertAsAdmin.error).not.toBeNull();
    expect(insertAsShadchan.error).not.toBeNull();
    expect(rpcAsShadchan.error).not.toBeNull();
  });

  test("דף הניהול: מציג את הפעולות, מסנן לפי סוג ומקושר מהתפריט", async ({
    page,
  }) => {
    // Act - מהתפריט
    await page.goto("/app/admin");
    await page.getByTestId("admin-nav-section-finance").click();
    await page
      .locator(ADMIN_NAV_LINKS_SCOPE)
      .getByRole("link", { name: "יומן פעילות" })
      .click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`${ACTIVITY_PATH}$`));
    await expect(
      page.getByRole("heading", { name: "יומן פעילות" }),
    ).toBeVisible();

    // Act - סינון להצעות
    await page.goto(`${ACTIVITY_PATH}?entity=shidduch`);

    // Assert
    const row = page
      .getByRole("row")
      .filter({ hasText: "מיועד ראשון - מיועדת ראשונה" })
      .first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("לא רלוונטי");
    await expect(
      page.getByRole("row").filter({ hasText: "כרטיס הושהה" }),
    ).toHaveCount(0);
  });
});
