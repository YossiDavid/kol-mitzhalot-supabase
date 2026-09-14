import { BookOpen, Info, LifeBuoy, Sparkles } from "lucide-react";

/**
 * תוכן האתר הכללי שמשתמש מחובר צריך להגיע אליו מתוך המערכת - בתפריט
 * הצד (דסקטופ) ובתפריט המשתמש שבהדר (גם במובייל, שם אין תפריט צד ופוטר).
 */
export const SITE_CONTENT_LINKS = [
  { title: "מרכז הידע", href: "/knowledge", icon: BookOpen },
  { title: "מה חדש", href: "/whats-new", icon: Sparkles },
  { title: "אודות", href: "/about", icon: Info },
  { title: "שירות ותמיכה", href: "/support", icon: LifeBuoy },
] as const;
