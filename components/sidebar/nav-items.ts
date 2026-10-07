import {
  BookmarkCheck,
  ClipboardList,
  Home,
  Inbox,
  MessageCircle,
  MessagesSquare,
  Network,
  Plus,
  Settings,
  UserSearch,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Route } from "next";

import type { Role } from "@/lib/user-role";

export const CHATS_URL = "/app/chats";

/** מפתח הקבוצה שפריט שייך אליה כשהמשתמש שדכן/מנהל */
export type NavGroupKey = "general" | "shadchanTools" | "personal";

export type NavItem = {
  title: string;
  url: Route;
  icon: LucideIcon;
  group: NavGroupKey;
};

export type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

/** שמות האזורים - משותפים לסיידבר ולדשבורד, כדי שיישארו זהים */
export const SHADCHAN_TOOLS_LABEL = "כלי שדכן";
export const PERSONAL_AREA_LABEL = "האזור האישי שלי";

const GROUP_LABELS: Record<NavGroupKey, string> = {
  general: "כללי",
  shadchanTools: SHADCHAN_TOOLS_LABEL,
  personal: PERSONAL_AREA_LABEL,
};

const GROUP_ORDER: readonly NavGroupKey[] = [
  "general",
  "shadchanTools",
  "personal",
];

/** התווית של הקבוצה היחידה למי שאינו שדכן/מנהל */
const SINGLE_GROUP_LABEL = "ניווט";

// סדר המערך הוא סדר הפריטים בקבוצה היחידה של הורה.
const allItems: readonly NavItem[] = [
  { title: "ראשי", url: "/app", icon: Home, group: "general" },
  {
    title: "מיועדים",
    url: "/app/students",
    icon: Users,
    group: "shadchanTools",
  },
  {
    title: "הוספת מיועד",
    url: "/app/students/create",
    icon: Plus,
    group: "personal",
  },
  { title: "צ'אטים", url: CHATS_URL, icon: MessageCircle, group: "general" },
  // הצעות שנשלחו לילדי המשתמש - לכל משתמש, גם שדכן יכול להיות הורה
  {
    title: "הצעות שקיבלתי",
    url: "/app/proposals",
    icon: Inbox,
    group: "personal",
  },
  {
    title: "לוח העבודה",
    url: "/app/canvas",
    icon: Network,
    group: "shadchanTools",
  },
  {
    title: "כל השידוכים שלי",
    url: "/app/shadchan/proposals",
    icon: ClipboardList,
    group: "shadchanTools",
  },
  // טיוטות שנשמרו בלוח העבודה וטרם נשלחו
  {
    title: "הצעות שמורות",
    url: "/app/shadchan/drafts",
    icon: BookmarkCheck,
    group: "shadchanTools",
  },
  // רשימת השדכנים פתוחה לכל משתמש מחובר; הפורום לשדכנים (ולמנהלים) בלבד
  {
    title: "שדכנים",
    url: "/app/shadchanim",
    icon: UserSearch,
    group: "personal",
  },
  {
    title: "פורום שדכנים",
    url: "/app/forums",
    icon: MessagesSquare,
    group: "shadchanTools",
  },
  { title: "הגדרות", url: "/app/settings", icon: Settings, group: "general" },
];

// לוח ההתאמות, רשימת השידוכים וההצעות השמורות הם כלי עבודה של שדכן/מנהל בלבד.
const shadchanOnlyUrls = [
  "/app/canvas",
  "/app/shadchan/proposals",
  "/app/shadchan/drafts",
  "/app/forums",
];
// רשימת המיועדים חושפת מיועדים של אחרים, ולכן סגורה להורה. "הוספת
// מיועד" נשארת פתוחה לכולם — הורה מוסיף את ילדיו.
const staffVisibleUrls = ["/app/students"];

/**
 * קבוצות הניווט הראשי לפי התפקידים. שדכן/מנהל מקבלים שלוש קבוצות (כללי,
 * כלי שדכן, האזור האישי); כל השאר קבוצה אחת. הניווט מציג את איחוד ההרשאות,
 * ולכן מי שהוא גם שדכן וגם איש צוות רואה את פריטי השדכן.
 */
export function navGroupsFor(roles: readonly Role[]): NavGroup[] {
  const isShadchanOrAdmin =
    roles.includes("shadchan") || roles.includes("admin");

  const items = allItems.filter((item) => {
    if (shadchanOnlyUrls.includes(item.url)) return isShadchanOrAdmin;
    if (staffVisibleUrls.includes(item.url))
      return isShadchanOrAdmin || roles.includes("staff");
    return true;
  });

  if (!isShadchanOrAdmin) {
    return [{ key: "main", label: SINGLE_GROUP_LABEL, items }];
  }

  return GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: items.filter((item) => item.group === key),
  }));
}
