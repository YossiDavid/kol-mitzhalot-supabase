"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function ChatsLayout({
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
      {/* Room list sidebar */}
      <div
        className={cn(
          "w-full shrink-0 md:w-[340px]",
          hasRoom ? "hidden md:block" : "block",
        )}
      >
        {children}
      </div>

      {/* Chat pane */}
      <div
        className={cn(
          "min-w-0 flex-1",
          hasRoom ? "block" : "hidden md:block",
        )}
      >
        {chat}
      </div>
    </div>
  );
}
