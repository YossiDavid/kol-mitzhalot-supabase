import {
  CreditCard,
  Image as ImageIcon,
  Inbox,
  PartyPopper,
  ShieldQuestion,
  UserPlus,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";

import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";
import { ISRAEL_TIME_ZONE } from "@/features/students/lib/new-card-window";

import { israelDayStartIso } from "./proposals-report";
import { THIRD_PARTY_PENDING_FILTER } from "./third-party-cards";

/**
 * המספרים של לוח הבקרה (/app/admin). כל "ממתין" משתמש בדיוק בהגדרה ובלקוח
 * של הדף שאליו הוא מקשר, כדי שהמספר כאן יהיה שווה למה שהדף מציג.
 * ספירה שנכשלה היא null (מוצגת כ"—") ולא 0.
 */

/** חלון "הצעות שנשלחו לאחרונה" */
export const RECENT_PROPOSALS_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type CountResponse = {
  count: number | null;
  error: Parameters<typeof describeSupabaseError>[0] | null;
};

/** מריץ ספירה אחת; כשל נרשם בלוג ומוחזר כ-null, בלי להפיל את שאר המספרים */
async function loadCount(
  label: string,
  run: () => PromiseLike<CountResponse>,
): Promise<number | null> {
  try {
    const { count, error } = await run();
    if (error || count === null) {
      console.error(
        `[admin/dashboard] ${label}`,
        error ? describeSupabaseError(error) : "no count returned",
      );
      return null;
    }
    return count;
  } catch (error) {
    console.error(`[admin/dashboard] ${label}`, error);
    return null;
  }
}

const HEAD_COUNT = { count: "exact", head: true } as const;

export type PendingQueueKey =
  | "shadchanRequests"
  | "staffRequests"
  | "photoRequests"
  | "thirdPartyCards"
  | "submissions"
  | "engagements"
  | "unmatchedPayments";

export type PendingQueue = {
  key: PendingQueueKey;
  title: string;
  href: Route;
  icon: LucideIcon;
  emptyText: string;
  /** ההגדרה ל"ממתין" והמקור, כפי שהדף היעד קורא אותם */
  load: () => Promise<number | null>;
};

export const PENDING_QUEUES: readonly PendingQueue[] = [
  {
    key: "shadchanRequests",
    title: "בקשות הצטרפות כשדכן",
    href: "/app/admin/shadchanim/requests",
    icon: HeartHandshake,
    emptyText: "אין בקשות ממתינות",
    // shadchanim_info.application_status = pending (כמו דף הבקשות)
    load: async () => {
      const supabase = await createClient();
      return loadCount("shadchan requests", () =>
        supabase
          .from("shadchanim_info")
          .select("id", HEAD_COUNT)
          .eq("application_status", "pending"),
      );
    },
  },
  {
    key: "staffRequests",
    title: "בקשות הצטרפות כאיש צוות",
    href: "/app/admin/staff/requests",
    icon: UserPlus,
    emptyText: "אין בקשות ממתינות",
    // staff_info.application_status = pending (כמו דף הבקשות)
    load: async () => {
      const supabase = await createClient();
      return loadCount("staff requests", () =>
        supabase
          .from("staff_info")
          .select("id", HEAD_COUNT)
          .eq("application_status", "pending"),
      );
    },
  },
  {
    key: "photoRequests",
    title: "בקשות צפייה בתמונה",
    href: "/app/admin/photo-requests",
    icon: ImageIcon,
    emptyText: "אין בקשות ממתינות",
    // photo_view_requests.status = pending (כמו דף הבקשות)
    load: async () => {
      const supabase = await createClient();
      return loadCount("photo requests", () =>
        supabase
          .from("photo_view_requests")
          .select("id", HEAD_COUNT)
          .eq("status", "pending"),
      );
    },
  },
  {
    key: "thirdPartyCards",
    title: "כרטיסי צד שלישי",
    href: "/app/admin/third-party-cards",
    icon: ShieldQuestion,
    emptyText: "אין כרטיסים ממתינים",
    // students: card_for=other, לא נמחק, וחסר אחד האישורים (כמו המסנן "ממתינים")
    load: () =>
      loadCount("third party cards", () =>
        createAdminClient()
          .from("students")
          .select("id", HEAD_COUNT)
          .eq("card_for", "other")
          .is("deleted_at", null)
          .or(THIRD_PARTY_PENDING_FILTER),
      ),
  },
  {
    key: "submissions",
    title: "פניות חדשות מהאתר",
    href: "/app/admin/content/submissions",
    icon: Inbox,
    emptyText: "אין פניות חדשות",
    // contact_submissions.status = new (פנייה שטרם נקראה)
    load: async () => {
      const supabase = await createClient();
      return loadCount("submissions", () =>
        supabase
          .from("contact_submissions")
          .select("id", HEAD_COUNT)
          .eq("status", "new"),
      );
    },
  },
  {
    key: "engagements",
    title: "מודעות מאורסים לפרסום",
    href: "/app/admin/content/engagements",
    icon: PartyPopper,
    emptyText: "אין מודעות ממתינות",
    // engagements.is_published = false (התווית "ממתין" בדף)
    load: async () => {
      const supabase = await createClient();
      return loadCount("engagements", () =>
        supabase
          .from("engagements")
          .select("id", HEAD_COUNT)
          .eq("is_published", false),
      );
    },
  },
  {
    key: "unmatchedPayments",
    title: "תשלומים שלא הותאמו",
    href: "/app/admin/donations",
    icon: CreditCard,
    emptyText: "אין תשלומים ללא התאמה",
    // donation_payments.matched = false (כמו אזור "לא הותאמו" בדף התרומות)
    load: async () => {
      const supabase = await createClient();
      return loadCount("unmatched payments", () =>
        supabase
          .from("donation_payments")
          .select("id", HEAD_COUNT)
          .eq("matched", false),
      );
    },
  },
];

export type GlanceStatKey =
  | "users"
  | "approvedShadchanim"
  | "activeCards"
  | "proposalsTotal"
  | "proposalsRecent"
  | "donationsThisMonth";

export type GlanceStat = {
  key: GlanceStatKey;
  label: string;
  href: Route;
  load: () => Promise<number | null>;
};

/** תחילת החודש הנוכחי לפי שעון ישראל, כ-ISO */
function israelMonthStartIso(now: Date): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TIME_ZONE,
  }).format(now); // YYYY-MM-DD
  return israelDayStartIso(`${today.slice(0, 8)}01`);
}

export const GLANCE_STATS: readonly GlanceStat[] = [
  {
    key: "users",
    label: "משתמשים רשומים",
    href: "/app/admin/users",
    // total של auth.admin.listUsers, כמו עימוד רשימת המשתמשים
    load: async () => {
      try {
        const { data, error } = await createAdminClient().auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });
        if (error || typeof data?.total !== "number") {
          console.error("[admin/dashboard] users", error ?? "no total");
          return null;
        }
        return data.total;
      } catch (error) {
        console.error("[admin/dashboard] users", error);
        return null;
      }
    },
  },
  {
    key: "approvedShadchanim",
    label: "שדכנים מאושרים",
    href: "/app/admin/shadchanim",
    // shadchanim_info.application_status = approved
    load: async () => {
      const supabase = await createClient();
      return loadCount("approved shadchanim", () =>
        supabase
          .from("shadchanim_info")
          .select("id", HEAD_COUNT)
          .eq("application_status", "approved"),
      );
    },
  },
  {
    key: "activeCards",
    label: "כרטיסים פעילים",
    href: "/app/admin/third-party-cards",
    // students לא נמחקו, בשידוכים, ולא מושהים על ידי ההנהלה
    load: () =>
      loadCount("active cards", () =>
        createAdminClient()
          .from("students")
          .select("id", HEAD_COUNT)
          .is("deleted_at", null)
          .eq("in_shidduchim", true)
          .is("admin_paused_at", null),
      ),
  },
  {
    key: "proposalsTotal",
    label: "הצעות שנשלחו",
    href: "/app/admin/proposals",
    // שורות shidduch_events (יומן ההצעות של דוח ההצעות)
    load: async () => {
      const supabase = await createClient();
      return loadCount("proposals total", () =>
        supabase.from("shidduch_events").select("id", HEAD_COUNT),
      );
    },
  },
  {
    key: "proposalsRecent",
    label: `הצעות ב-${RECENT_PROPOSALS_DAYS} הימים האחרונים`,
    href: "/app/admin/proposals",
    load: async () => {
      const supabase = await createClient();
      const since = new Date(
        Date.now() - RECENT_PROPOSALS_DAYS * MS_PER_DAY,
      ).toISOString();
      return loadCount("proposals recent", () =>
        supabase
          .from("shidduch_events")
          .select("id", HEAD_COUNT)
          .gte("created_at", since),
      );
    },
  },
  {
    key: "donationsThisMonth",
    label: "תרומות ששולמו החודש",
    href: "/app/admin/donations",
    // donations.status = paid שנוצרו מתחילת החודש (שעון ישראל); מספר ולא סכום
    load: async () => {
      const supabase = await createClient();
      const monthStart = israelMonthStartIso(new Date());
      return loadCount("donations this month", () =>
        supabase
          .from("donations")
          .select("id", HEAD_COUNT)
          .eq("status", "paid")
          .gte("created_at", monthStart),
      );
    },
  },
];

export type CountEntry<K extends string> = { key: K; count: number | null };

/** מריץ את כל הטעינות במקביל; כל אחת מטפלת בשגיאה שלה */
export async function loadAllCounts<K extends string>(
  definitions: readonly { key: K; load: () => Promise<number | null> }[],
): Promise<CountEntry<K>[]> {
  return Promise.all(
    definitions.map(async ({ key, load }) => ({ key, count: await load() })),
  );
}
