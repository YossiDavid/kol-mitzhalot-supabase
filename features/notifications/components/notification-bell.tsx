"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

/** כמה התראות נטענות לפופאובר. מעבר לזה אין ערך — זו לא רשימה מלאה. */
const FETCH_LIMIT = 20;

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function NotificationBell({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [items, setItems] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);

  const unreadCount = items.filter((n) => !n.read_at).length;

  // טעינה ראשונית. RLS כבר מצמצם לשורות של המשתמש, ולכן אין צורך
  // בסינון על user_id בשאילתה.
  React.useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);

      if (!isMounted || error) return;
      setItems((data ?? []) as Notification[]);
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Realtime — מסונן בצד השרת לפי הנמען, בניגוד לסינון בצד הלקוח
  // שנעשה ב-room-list. כאן זה גם חוסך תעבורה וגם מדויק יותר.
  React.useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification;
          setItems((prev) =>
            prev.some((n) => n.id === incoming.id)
              ? prev
              : [incoming, ...prev].slice(0, FETCH_LIMIT),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // סימון כנקראו בפתיחת הפופאובר. מעדכנים אופטימית ומגלגלים אחורה
  // בכישלון, כדי שהנקודה לא תיעלם על סמך כתיבה שלא הצליחה.
  const markAllRead = React.useCallback(async () => {
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const now = new Date().toISOString();
    const previous = items;
    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now })),
    );

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .in("id", unreadIds);

    if (error) setItems(previous);
  }, [items, supabase]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void markAllRead();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? `התראות, ${unreadCount} חדשות` : "התראות"
          }
        >
          <BellRing />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute end-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" dir="rtl" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-body-sm font-bold">התראות</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-medium text-destructive tabular-nums">
              {unreadCount} חדשות
            </span>
          )}
        </div>
        <Separator />

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-body-sm text-muted-foreground">
            אין התראות
          </p>
        ) : (
          <ScrollArea className="h-[320px]">
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const isUnread = !n.read_at;
                const row = (
                  <div className="flex items-start gap-2.5 px-4 py-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        isUnread ? "bg-destructive" : "bg-transparent",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-body-sm",
                            isUnread ? "font-bold" : "font-medium",
                          )}
                        >
                          {n.title}
                        </p>
                        <time
                          dateTime={n.created_at}
                          className="shrink-0 text-caption text-muted-foreground"
                        >
                          {formatRelative(n.created_at)}
                        </time>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link as Route}
                        onClick={() => setOpen(false)}
                        className="block transition-colors hover:bg-muted"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
