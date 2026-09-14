"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * שתי החלוניות של הצ'אטים. ה-pathname קובע מי מהן מוצגת במובייל, ולכן
 * הוא נקרא כאן ולא ב-layout: הצהרת הסגמנט instant חוקית רק בקובץ שרת.
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
    <div className="flex h-full overflow-hidden">
      {/* רשימת השיחות */}
      <div
        className={cn(
          "w-full shrink-0 md:w-[340px]",
          hasRoom ? "hidden md:block" : "block",
        )}
      >
        {children}
      </div>

      {/* חלון השיחה */}
      <div
        className={cn("min-w-0 flex-1", hasRoom ? "block" : "hidden md:block")}
      >
        {chat}
      </div>
    </div>
  );
}
