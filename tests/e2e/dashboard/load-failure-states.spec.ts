/**
 * Callers: Playwright `chromium` project; הבדיקה אינה פותחת דפדפן.
 * Bug: שאילתות בדשבורד וב-getMyProposals רשמו שגיאה והחזירו [], ולכן תקלה
 * בשליפה נראתה כמצב הריק ("אין הצעות", "עוד לא הוספת מועדפים").
 *
 * השאילתות רצות בשרת בלבד, ואין בריפו דרך לכפות כשל בשרת מתוך בדיקת דפדפן
 * (page.route לא רואה אותן). לכן נבדקים בנפרד: (1) השאילתות מול לקוח Supabase
 * מדומה שמחזיר שגיאה - הן מחזירות failed; (2) הרכיבים מרונדרים עם failed -
 * מציגים "לא הצלחנו לטעון" ולא את המצב הריק. החיבור ביניהם (הדף שמעביר את
 * הדגל לרכיב) מכוסה בהידור הטיפוסים בלבד, לא בהרצה מקצה לקצה.
 */
import { expect, test } from "@playwright/test";

import {
  renderToHtml,
  installReactJsxRuntime,
} from "../helpers/render-component";
import {
  getChatsWithLastMessage,
  getFavoriteStudents,
  getOwnStudents,
  getRecentShidduchim,
} from "../../../features/dashboard/lib/queries";
import { getMyProposals } from "../../../features/shidduchim/lib/proposals-data";

type Outcome = { data: unknown; error: { message: string } | null };

/**
 * לקוח Supabase מדומה: כל שרשרת שאילתה (from/select/eq/...) מסתיימת באותה
 * תוצאה, וגם rpc. מספיק כדי לבדוק רק את טיפול הקוד בשגיאה.
 */
function fakeSupabase<T>(outcome: Outcome): T {
  const chain: unknown = new Proxy(() => chain, {
    get: (_target, prop) =>
      prop === "then"
        ? (resolve: (value: Outcome) => unknown) => resolve(outcome)
        : () => chain,
    apply: () => chain,
  });
  return chain as T;
}

const FAILURE: Outcome = { data: null, error: { message: "boom" } };
const EMPTY: Outcome = { data: [], error: null };

/** רכיבי האפליקציה נטענים רק אחרי החלפת ה-jsx-runtime של Playwright */
async function loadComponents() {
  installReactJsxRuntime();
  const [shadchanChat, shadchanShidduchim, userShidduchim, userChat, failed] =
    await Promise.all([
      import("../../../features/dashboard/components/shadchan/chat"),
      import("../../../features/dashboard/components/shadchan/active-shidduchim"),
      import("../../../features/dashboard/components/user/active-shidduchim"),
      import("../../../features/dashboard/components/user/chat"),
      import("../../../features/shidduchim/components/proposals-load-failed"),
    ]);
  return {
    ShadchanChat: shadchanChat.default,
    ShadchanActiveShidduchim: shadchanShidduchim.default,
    UserActiveShidduchim: userShidduchim.default,
    UserChat: userChat.default,
    ProposalsLoadFailed: failed.ProposalsLoadFailed,
  };
}

test.describe("שאילתות הדשבורד: כשל אינו רשימה ריקה", () => {
  type Supabase = Parameters<typeof getOwnStudents>[0];

  test("מועדפים, כרטיסים והצעות אחרונות מחזירים failed בשגיאה", async () => {
    // Arrange
    const supabase = fakeSupabase<Supabase>(FAILURE);

    // Act
    const [favorites, own, recent] = await Promise.all([
      getFavoriteStudents(supabase, ["id-1"]),
      getOwnStudents(supabase, "user-1"),
      getRecentShidduchim(supabase, "user-1"),
    ]);

    // Assert
    expect(favorites).toEqual({ students: [], failed: true });
    expect(own).toEqual({ students: [], failed: true });
    expect(recent).toEqual({ shidduchim: [], failed: true });
  });

  test("אותן שאילתות מחזירות failed=false כשהרשימה באמת ריקה", async () => {
    // Arrange
    const supabase = fakeSupabase<Supabase>(EMPTY);

    // Act
    const own = await getOwnStudents(supabase, "user-1");
    const recent = await getRecentShidduchim(supabase, "user-1");

    // Assert
    expect(own.failed).toBe(false);
    expect(recent.failed).toBe(false);
  });

  test("שליפת חדרי צ'אט שנכשלה מחזירה failed", async () => {
    // Arrange
    const supabase = fakeSupabase<Supabase>(FAILURE);

    // Act
    const result = await getChatsWithLastMessage(supabase, "user-1");

    // Assert
    expect(result).toEqual({ chats: [], failed: true });
  });

  test("getMyProposals: שגיאה או מבנה לא צפוי = failed, ריק אמיתי = לא", async () => {
    // Arrange
    type ProposalsSupabase = Parameters<typeof getMyProposals>[0];

    // Act
    const onError = await getMyProposals(
      fakeSupabase<ProposalsSupabase>(FAILURE),
    );
    const onBadShape = await getMyProposals(
      fakeSupabase<ProposalsSupabase>({ data: [{ nope: 1 }], error: null }),
    );
    const onEmpty = await getMyProposals(
      fakeSupabase<ProposalsSupabase>(EMPTY),
    );

    // Assert
    expect(onError).toEqual({ proposals: [], failed: true });
    expect(onBadShape).toEqual({ proposals: [], failed: true });
    expect(onEmpty).toEqual({ proposals: [], failed: false });
  });
});

test.describe("רכיבי הדשבורד: failed מציג שגיאה ולא מצב ריק", () => {
  test("הצעות פתוחות (הורה)", async () => {
    // Arrange
    const { UserActiveShidduchim } = await loadComponents();

    // Act
    const failed = renderToHtml(UserActiveShidduchim, {
      shiduchim: [],
      failed: true,
    });
    const empty = renderToHtml(UserActiveShidduchim, { shiduchim: [] });

    // Assert
    expect(failed).toContain("לא הצלחנו לטעון את ההצעות");
    expect(failed).not.toContain("עדיין לא קיבלת הצעות משדכנים");
    expect(empty).toContain("עדיין לא קיבלת הצעות משדכנים");
    expect(empty).not.toContain("לא הצלחנו לטעון");
  });

  test("מצב ריק של הצעות פתוחות ללא קישור לעמוד הפרימיום", async () => {
    // Arrange
    const { UserActiveShidduchim } = await loadComponents();

    // Act
    const empty = renderToHtml(UserActiveShidduchim, { shiduchim: [] });

    // Assert
    expect(empty).not.toContain("/app/premium");
    expect(empty).not.toContain("להצטרפות למנוי");
  });

  test("שידוכים באויר (שדכן)", async () => {
    // Arrange
    const { ShadchanActiveShidduchim } = await loadComponents();

    // Act
    const failed = renderToHtml(ShadchanActiveShidduchim, {
      shiduchim: [],
      failed: true,
    });
    const empty = renderToHtml(ShadchanActiveShidduchim, { shiduchim: [] });

    // Assert
    expect(failed).toContain("לא הצלחנו לטעון את ההצעות");
    expect(failed).not.toContain("עדיין לא שלחת הצעות לשידוכים");
    expect(empty).toContain("עדיין לא שלחת הצעות לשידוכים");
  });

  test("צ'אטים: שגיאה, ומצב ריק שבו התווית והיעד מתאימים", async () => {
    // Arrange
    const { ShadchanChat, UserChat } = await loadComponents();

    // Act
    const shadchanFailed = renderToHtml(ShadchanChat, {
      chats: [],
      failed: true,
    });
    const userFailed = renderToHtml(UserChat, { chats: [], failed: true });
    const shadchanEmpty = renderToHtml(ShadchanChat, { chats: [] });

    // Assert
    expect(shadchanFailed).toContain("לא הצלחנו לטעון את הצ&#x27;אטים");
    expect(userFailed).toContain("לא הצלחנו לטעון את הצ&#x27;אטים");
    expect(shadchanEmpty).toContain('href="/app/students"');
    expect(shadchanEmpty).toContain("לרשימת המיועדים");
    expect(shadchanEmpty).not.toContain("לצ&#x27;אט<");
  });

  test("דף ההצעות: רכיב השגיאה אינו מציע 'אין הצעות עדיין'", async () => {
    // Arrange
    const { ProposalsLoadFailed } = await loadComponents();

    // Act
    const html = renderToHtml(ProposalsLoadFailed, {
      title: "לא הצלחנו לטעון את ההצעות",
    });

    // Assert
    expect(html).toContain("לא הצלחנו לטעון את ההצעות");
    expect(html).toContain('data-testid="proposals-load-failed"');
    expect(html).not.toContain("אין הצעות עדיין");
  });
});
