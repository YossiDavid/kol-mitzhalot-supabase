"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * שתי החלוניות של הצ'אטים. ה-pathname קובע מי מהן מוצגת במובייל, ולכן
 * הוא נקרא כאן ולא ב-layout: הצהרת הסגמנט instant חוקית רק בקובץ שרת.
 *
 * הגובה נקבע כאן פעם אחת, והחלוניות ממלאות אותו כעמודות flex — כך אזור
 * ההודעות תופס את כל המקום שנשאר בין הכותרת לשדה הכתיבה, בלי חישובי גובה
 * פנימיים. --chats-offset הוא מה שהמעטפת תופסת מעל ומתחת לתוכן:
 * מובייל — כותרת h-16 + py-4 עליון + pb-24 לסרגל הניווט התחתון (11rem);
 * דסקטופ — כותרת h-16 + py-5 (6.5rem).
 */
export function ChatsPanes({
  children,
  chat,
}: {
  children: React.ReactNode;
  chat: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasRoom = pathname.startsWith("/app/chats/");

  return (
    <div className="box flex h-[calc(100svh-var(--chats-offset))] min-h-104 overflow-hidden border border-border [--chats-offset:11rem] md:[--chats-offset:6.5rem]">
      {/* רשימת השיחות */}
      <div
        className={cn(
          "h-full w-full shrink-0 md:w-[340px] md:border-e md:border-border lg:w-[360px]",
          hasRoom ? "hidden md:block" : "block",
        )}
      >
        {children}
      </div>

      {/* חלון השיחה */}
      <div
        className={cn(
          "h-full min-w-0 flex-1",
          hasRoom ? "block" : "hidden md:block",
        )}
      >
        {chat}
      </div>
    </div>
  );
}
