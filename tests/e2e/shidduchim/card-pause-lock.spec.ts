import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";
import { clearEvents, resetCardRules } from "./proposal-events";

/** אותו משתמש "מנהל כרטיסים" ש-setupShidduchFixtures מקים */
const CARD_MANAGER_EMAIL = "playwright-card-manager@kol-mitzhalot.test";

/**
 * נעילת השהיית ההנהלה, ותמונת הבחור, ברמת המסד.
 *
 * מנהל הכרטיס מעדכן את students ישירות תחת RLS, ולכן הכללים נבדקים כאן
 * בסשן אמיתי שלו - לא רק ב-UI. הסשן נוצר מקישור התחברות שה-service role
 * מנפיק, ואינו תלוי בסיסמה.
 */
test.describe("השהיית הנהלה ותמונת בחור - אכיפה במסד", () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let fx: ShidduchFixtures;
  let testUserId: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const { data: link, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: CARD_MANAGER_EMAIL,
      });
    if (linkError || !link.properties) {
      throw new Error(`יצירת קישור התחברות נכשלה: ${linkError?.message}`);
    }
    owner = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: otpError } = await owner.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (otpError) throw new Error(`התחברות הבעלים נכשלה: ${otpError.message}`);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  test.afterEach(async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await clearEvents(admin, [fx.groomFirst, fx.brideFirst]);
    await resetCardRules(admin, [fx.groomFirst, fx.brideFirst]);
    // בבדיקת התמונה הבחור מועבר לבעלים אחר - מחזירים לבעלים המקורי
    await admin
      .from("students")
      .update({ user_id: fx.cardManagerId })
      .eq("id", fx.groomFirst);
  });

  test.describe("נעילת השהיית הנהלה", () => {
    const adminPause = async () => {
      const { error } = await admin
        .from("students")
        .update({
          admin_paused_at: new Date().toISOString(),
          admin_paused_by: testUserId,
        })
        .eq("id", fx.groomFirst);
      expect(error).toBeNull();
    };

    test("השהיית הנהלה מכריחה in_shidduchim=false", async () => {
      // Act
      await adminPause();

      // Assert
      const { data } = await admin
        .from("students")
        .select("in_shidduchim, admin_paused_at")
        .eq("id", fx.groomFirst)
        .single();
      expect(data?.in_shidduchim).toBe(false);
      expect(data?.admin_paused_at).not.toBeNull();
    });

    test("הבעלים לא יכול לבטל את ההשהיה דרך המתג", async () => {
      // Arrange
      await adminPause();

      // Act - ה-UPDATE עובר, אבל הערך שנשמר נשאר false
      const { data, error } = await owner
        .from("students")
        .update({ in_shidduchim: true })
        .eq("id", fx.groomFirst)
        .select("in_shidduchim")
        .single();

      // Assert
      expect(error).toBeNull();
      expect(data?.in_shidduchim).toBe(false);
    });

    test("הבעלים לא יכול לגעת בעמודות ההשהיה", async () => {
      // Arrange
      await adminPause();

      // Act
      const clear = await owner
        .from("students")
        .update({ admin_paused_at: null, admin_paused_by: null })
        .eq("id", fx.groomFirst);

      // Assert
      expect(clear.error?.message).toContain("admin_pause_forbidden");
      const { data } = await admin
        .from("students")
        .select("admin_paused_at")
        .eq("id", fx.groomFirst)
        .single();
      expect(data?.admin_paused_at).not.toBeNull();
    });

    test("הבעלים לא יכול להשהות לבד בעמודות ההנהלה", async () => {
      // Act
      const result = await owner
        .from("students")
        .update({ admin_paused_at: new Date().toISOString() })
        .eq("id", fx.groomFirst);

      // Assert
      expect(result.error?.message).toContain("admin_pause_forbidden");
    });

    test("בלי השהיית הנהלה הבעלים מחליף את המתג כרגיל", async () => {
      // Act
      const off = await owner
        .from("students")
        .update({ in_shidduchim: false })
        .eq("id", fx.groomFirst)
        .select("in_shidduchim")
        .single();
      const on = await owner
        .from("students")
        .update({ in_shidduchim: true })
        .eq("id", fx.groomFirst)
        .select("in_shidduchim")
        .single();

      // Assert
      expect(off.data?.in_shidduchim).toBe(false);
      expect(on.data?.in_shidduchim).toBe(true);
    });

    test("הבעלים קובע ומבטל מכסה ישירות תחת RLS", async () => {
      // Act
      const set = await owner
        .from("students")
        .update({ proposal_limit_count: 2, proposal_limit_period: "week" })
        .eq("id", fx.groomFirst)
        .select("proposal_limit_count, proposal_limit_period")
        .single();
      const unset = await owner
        .from("students")
        .update({ proposal_limit_count: null, proposal_limit_period: null })
        .eq("id", fx.groomFirst)
        .select("proposal_limit_count")
        .single();

      // Assert
      expect(set.data).toEqual({
        proposal_limit_count: 2,
        proposal_limit_period: "week",
      });
      expect(unset.data?.proposal_limit_count).toBeNull();
    });
  });

  test.describe("תמונת הבחור לצד הכלה", () => {
    const withheld = async () => {
      const { data, error } = await admin.rpc("groom_photo_withheld", {
        uid: fx.cardManagerId,
        sid: fx.groomFirst,
      });
      expect(error).toBeNull();
      return data as boolean;
    };

    test("מנהל כרטיס הכלה שקיבל הצעה בלי תמונה - התמונה מוסתרת, וגם בהרשאת הצפייה", async () => {
      // Arrange - מנהל הכרטיסים הוא גם בעל הבחור, לכן לצורך הבדיקה כרטיס
      // הבחור עובר לבעלים אחר, ומנהל הכרטיסים נשאר בעל הכלה
      const { error: ownerError } = await admin
        .from("students")
        .update({ user_id: fx.otherShadchanId })
        .eq("id", fx.groomFirst);
      expect(ownerError).toBeNull();
      const shidduchId = await insertShidduch(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
      });
      await admin
        .from("shidduchim")
        .update({
          status: "sent",
          recipient_scope: "both",
          sent_at: new Date().toISOString(),
          share_groom_photo: false,
        })
        .eq("id", shidduchId);

      // Assert
      expect(await withheld()).toBe(true);
      const { data: canView } = await admin.rpc("can_view_student_photo", {
        uid: fx.cardManagerId,
        sid: fx.groomFirst,
      });
      expect(canView).toBe(false);

      // Act - השדכן מאשר
      await admin
        .from("shidduchim")
        .update({ share_groom_photo: true })
        .eq("id", shidduchId);

      // Assert
      expect(await withheld()).toBe(false);
      const { data: canViewAfter } = await admin.rpc("can_view_student_photo", {
        uid: fx.cardManagerId,
        sid: fx.groomFirst,
      });
      expect(canViewAfter).toBe(true);
    });

    test("בעלים, שדכן ואנונימי לא מושפעים מהדגל", async () => {
      // Arrange
      const shidduchId = await insertShidduch(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
      });
      await admin
        .from("shidduchim")
        .update({
          status: "sent",
          recipient_scope: "both",
          sent_at: new Date().toISOString(),
          share_groom_photo: false,
        })
        .eq("id", shidduchId);

      // Act
      const asOwner = await admin.rpc("groom_photo_withheld", {
        uid: fx.cardManagerId,
        sid: fx.groomFirst,
      });
      const asShadchan = await admin.rpc("groom_photo_withheld", {
        uid: testUserId,
        sid: fx.groomFirst,
      });
      const asAnonymous = await admin.rpc("groom_photo_withheld", {
        uid: null,
        sid: fx.groomFirst,
      });

      // Assert - הבעלים (מנהל הכרטיסים) והשדכן רואים תמיד; אנונימי לא מושפע
      expect(asOwner.data).toBe(false);
      expect(asShadchan.data).toBe(false);
      expect(asAnonymous.data).toBe(false);
    });
  });
});
