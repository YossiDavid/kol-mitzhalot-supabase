import type { User } from "@supabase/supabase-js";

import type { createAdminClient } from "@/lib/supabase/admin";

import {
  buildEngagementFromCards,
  type EngagementCard,
} from "./build-engagement-from-cards";
import { setStudentPersonalStatus } from "./set-student-personal-status";

type AdminClient = ReturnType<typeof createAdminClient>;

const CARD_COLUMNS =
  "id, first_name, last_name, city, parents_info, education_history(institution_type, name)";

type CardRow = EngagementCard & { id: string };

export type CloseMatchResult = {
  /** נוצרה מודעה חדשה (false גם כשהמודעה כבר קיימת) */
  engagementCreated: boolean;
  /** משהו נכשל והנתונים לא מלאים - לאזהרה בממשק; הסטטוס עצמו כבר נשמר */
  hasWarning: boolean;
};

function failure(step: string, error: unknown): CloseMatchResult {
  console.error(`[engagements/close-match] ${step}`, error);
  return { engagementCreated: false, hasWarning: true };
}

/** שם לתצוגה: פרופיל, ובהיעדרו מטא-דאטה של המשתמש ב-auth */
async function resolveDisplayName(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  const meta = authData?.user?.user_metadata;
  const name = [
    profile?.first_name || meta?.firstName,
    profile?.last_name || meta?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || null;
}

async function loadCards(
  admin: AdminClient,
  groomId: string,
  brideId: string,
): Promise<{ groom: CardRow; bride: CardRow } | null> {
  const { data, error } = await admin
    .from("students")
    .select(CARD_COLUMNS)
    .in("id", [groomId, brideId])
    .is("deleted_at", null);
  if (error) {
    console.error("[engagements/close-match] load cards", error);
    return null;
  }
  const rows = (data ?? []) as unknown as CardRow[];
  const groom = rows.find((row) => row.id === groomId);
  const bride = rows.find((row) => row.id === brideId);
  return groom && bride ? { groom, bride } : null;
}

/**
 * שידוך שהושלם בתוך המערכת: מסמן את שני הכרטיסים כמאורסים ויוצר מודעת
 * אירוסין מנתוני הכרטיסים.
 *
 * המודעה נוצרת תמיד כלא מפורסמת (is_published=false): פרסום ציבורי נשאר
 * תחת האישור של המנהל בעמוד מודעות מאורסים, כמו מודעות מהטופס באתר.
 *
 * אידמפוטנטי: UNIQUE על engagements.shidduch_id + ON CONFLICT DO NOTHING,
 * כך ששמירה חוזרת של "הושלם" (או החלפה הלוך ושוב) לא יוצרת מודעה שנייה
 * ולא דורסת עריכה/פרסום של המנהל.
 *
 * לא זורק: כשל כאן לא מבטל את שינוי הסטטוס. הוא נרשם ביומן ומוחזר
 * כ-hasWarning כדי שהממשק יציג אזהרה.
 */
export async function closeMatchInSystem(
  admin: AdminClient,
  params: { shidduchId: string; actor: User },
): Promise<CloseMatchResult> {
  const { shidduchId, actor } = params;

  const { data: shidduch, error: shidduchError } = await admin
    .from("shidduchim")
    .select("id, groom_id, bride_id, shadchan_id")
    .eq("id", shidduchId)
    .maybeSingle();
  if (shidduchError || !shidduch)
    return failure("load shidduch", shidduchError);

  const [groomStatus, brideStatus] = await Promise.all([
    setStudentPersonalStatus(admin, shidduch.groom_id, "engaged"),
    setStudentPersonalStatus(admin, shidduch.bride_id, "engaged"),
  ]);
  const cardsFailed = [groomStatus, brideStatus].some(
    (result) => result.error || !result.data,
  );
  if (cardsFailed) {
    console.error("[engagements/close-match] mark cards engaged", {
      groom: groomStatus.error,
      bride: brideStatus.error,
    });
  }

  const cards = await loadCards(admin, shidduch.groom_id, shidduch.bride_id);
  if (!cards) return { engagementCreated: false, hasWarning: true };

  const [shadchanName, submitterName] = await Promise.all([
    resolveDisplayName(admin, shidduch.shadchan_id),
    resolveDisplayName(admin, actor.id),
  ]);

  const draft = buildEngagementFromCards({
    ...cards,
    shadchanName,
    // המודעה נקראת ציבורית כשהיא מפורסמת: נשמר רק שם הפועל, לעולם לא
    // הטלפון או המייל שלו
    submitter: { name: submitterName, phone: null, email: null },
    closedAt: new Date(),
  });

  const { data: inserted, error: insertError } = await admin
    .from("engagements")
    .upsert(
      {
        ...draft,
        shidduch_id: shidduch.id,
        groom_student_id: shidduch.groom_id,
        bride_student_id: shidduch.bride_id,
        source: "system",
        // לא מפורסם עד שמנהל מאשר - ראה הערה בראש הפונקציה
        is_published: false,
      },
      { onConflict: "shidduch_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) return failure("insert engagement", insertError);

  return {
    engagementCreated: (inserted?.length ?? 0) > 0,
    hasWarning: cardsFailed,
  };
}
