import {
  BookOpen,
  FileText,
  GraduationCap,
  HeartHandshake,
  Image as ImageIcon,
  Inbox,
  Landmark,
  Link2,
  ListChecks,
  Mail,
  ShieldQuestion,
  Star,
  UserCheck,
  UserPlus,
  UsersRound,
  Users,
  Heart,
  Settings,
  IdCard,
  Database,
  type LucideIcon,
} from "lucide-react";

import type { Route } from "next";

/** דף יעד בניהול - מקור יחיד לסיידבר (דסקטופ) ולתפריט במובייל */
export type AdminNavItem = {
  title: string;
  url: Route;
  icon: LucideIcon;
};

/** אזור בתפריט הניהול: פריט עליון עם תתי עמודים */
export type AdminNavSection = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: readonly AdminNavItem[];
};

export const ADMIN_HOME_URL: Route = "/app/admin";
export const APP_HOME_URL: Route = "/app";

/**
 * האזורים בסדר התצוגה. לחיצה על האזור מובילה לתת-העמוד הראשון שלו
 * (ראו adminSectionLandingUrl) - כלל אחד לכל האזורים.
 */
export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    key: "people",
    label: "אנשים",
    icon: Users,
    items: [
      {
        title: "כל המשתמשים",
        url: "/app/admin/users",
        icon: Users,
      },
      {
        title: "כל השדכנים",
        url: "/app/admin/shadchanim",
        icon: UserCheck,
      },
      {
        title: "בקשות הצטרפות כשדכן",
        url: "/app/admin/shadchanim/requests",
        icon: HeartHandshake,
      },
      {
        title: "בקשות הצטרפות כאיש צוות",
        url: "/app/admin/staff/requests",
        icon: UserPlus,
      },
    ],
  },
  {
    key: "cards",
    label: "כרטיסים והצעות",
    icon: IdCard,
    items: [
      {
        title: "כרטיסי צד שלישי",
        url: "/app/admin/third-party-cards",
        icon: ShieldQuestion,
      },
      {
        title: "בקשות צפייה בתמונה",
        url: "/app/admin/photo-requests",
        icon: ImageIcon,
      },
      {
        title: "דוח הצעות",
        url: "/app/admin/proposals",
        icon: ListChecks,
      },
      {
        title: "שיוך מוסד המוני",
        url: "/app/admin/students/institutions",
        icon: Link2,
      },
    ],
  },
  {
    key: "content",
    label: "תוכן האתר",
    icon: BookOpen,
    items: [
      {
        title: "מאמרים",
        url: "/app/admin/content/articles",
        icon: FileText,
      },
      {
        title: "מודעות מאורסים",
        url: "/app/admin/content/engagements",
        icon: Heart,
      },
      {
        title: "המלצות רבנים",
        url: "/app/admin/content/endorsements",
        icon: Star,
      },
      {
        title: "רשימת תפוצה",
        url: "/app/admin/content/newsletter",
        icon: Mail,
      },
      {
        title: "פניות מהאתר",
        url: "/app/admin/content/submissions",
        icon: Inbox,
      },
    ],
  },
  {
    key: "databases",
    label: "מאגרים",
    icon: Database,
    items: [
      {
        title: "מוסדות לימוד",
        url: "/app/admin/institutions",
        icon: GraduationCap,
      },
      {
        title: "חסידויות וקהילות",
        url: "/app/admin/communities",
        icon: UsersRound,
      },
    ],
  },
  {
    key: "finance",
    label: "כספים והגדרות",
    icon: Landmark,
    items: [
      {
        title: "תרומות",
        url: "/app/admin/donations",
        icon: HeartHandshake,
      },
      {
        title: "הגדרות מערכת",
        url: "/app/admin/settings",
        icon: Settings,
      },
    ],
  },
];

/** היעד של לחיצה על האזור עצמו: תת-העמוד הראשון שלו */
export function adminSectionLandingUrl(section: AdminNavSection): Route {
  return section.items[0].url;
}

/**
 * התת-עמוד הפעיל: ההתאמה הארוכה ביותר מבין כל התתי-עמודים, כך ש-
 * /shadchanim/requests מדליק רק את הבקשות ולא את "כל השדכנים", ותת-עמוד
 * עמוק (users/123) מדליק את הפריט של הרשימה.
 */
export function activeAdminItemUrl(pathname: string): string | null {
  let best: string | null = null;
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const { url } of section.items) {
      const isMatch = pathname === url || pathname.startsWith(`${url}/`);
      if (isMatch && (best === null || url.length > best.length)) best = url;
    }
  }
  return best;
}

/** האזור שמכיל את העמוד הנוכחי, או null (דף הבית של הניהול, ההאב) */
export function activeAdminSectionKey(pathname: string): string | null {
  const activeUrl = activeAdminItemUrl(pathname);
  if (!activeUrl) return null;
  return (
    ADMIN_NAV_SECTIONS.find((section) =>
      section.items.some((item) => item.url === activeUrl),
    )?.key ?? null
  );
}

/** האם הנתיב בתוך אזור הניהול (לכל עומק) */
export function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_HOME_URL || pathname.startsWith(`${ADMIN_HOME_URL}/`)
  );
}
