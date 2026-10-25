"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { openContextRoom, openRoomErrorMessage } from "@/features/chats/lib/open-room";
import type { SystemAnnouncement } from "@/features/announcements/lib/announcements";
import { ADMIN_IMPERSONATION_BACKUP_KEY } from "@/lib/impersonation";

const FETCH_LIMIT = 10;

function isImpersonating(): boolean {
  try {
    return window.sessionStorage.getItem(ADMIN_IMPERSONATION_BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * הודעות המערכת שעדיין לא נקראו, אחת בכל פעם, מעל תוכן הדף. "קראתי" רושם
 * קריאה (system_announcement_reads); "השבה להנהלה" פותח צ'אט עם המנהל ששלח.
 * RLS מחזיר רק הודעות פעילות שהקהל שלהן כולל את המשתמש (למנהל - הכל, ולכן
 * מנהל אינו רואה באנר: הוא מנהל את ההודעות בעמוד הניהול).
 */
export function SystemAnnouncementBanner({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [queue, setQueue] = useState<SystemAnnouncement[]>([]);
  const [isReplying, startReply] = useTransition();

  useEffect(() => {
    // מנהל שמתחזה למשתמש: לא מציגים, כדי שלא יסמן "קראתי" בשם המשתמש
    if (isAdmin || isImpersonating()) return;
    let isMounted = true;
    async function load() {
      const [{ data: rows, error }, { data: reads }] = await Promise.all([
        supabase
          .from("system_announcements")
          .select("id, title, body, audience, created_by, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(FETCH_LIMIT),
        supabase
          .from("system_announcement_reads")
          .select("announcement_id")
          .eq("user_id", userId),
      ]);
      if (!isMounted) return;
      if (error) {
        console.error("[announcements/banner] load failed", error.message);
        return;
      }
      const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
      setQueue(
        (rows ?? [])
          .filter((row) => !readIds.has(row.id))
          .map((row) => ({
            id: row.id,
            title: row.title,
            body: row.body,
            audience: row.audience,
            createdBy: row.created_by,
            createdAt: row.created_at,
          })),
      );
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [supabase, userId, isAdmin]);

  const current = queue[0];
  if (!current) return null;

  async function markRead(announcementId: string) {
    setQueue((prev) => prev.filter((a) => a.id !== announcementId));
    const { error } = await supabase
      .from("system_announcement_reads")
      .insert({ announcement_id: announcementId, user_id: userId });
    // 23505: כבר סומן (לשונית אחרת) - אין מה לעשות
    if (error && error.code !== "23505") {
      console.error("[announcements/banner] mark read failed", error.message);
    }
  }

  function reply(announcement: SystemAnnouncement) {
    if (!announcement.createdBy) return;
    const adminId = announcement.createdBy;
    startReply(async () => {
      try {
        const roomId = await openContextRoom(adminId, { kind: "general" });
        await markRead(announcement.id);
        router.push(`/app/chats/${roomId}?compose=1` as Route);
      } catch (error) {
        console.error("[announcements/banner] reply failed", error);
        toast.error(openRoomErrorMessage(error));
      }
    });
  }

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-primary/40 bg-primary-muted px-4 py-3"
      data-testid="system-announcement-banner"
    >
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-body font-bold">{current.title}</p>
          <p className="text-body-sm whitespace-pre-line">{current.body}</p>
          {queue.length > 1 && (
            <p className="text-caption text-muted-foreground">
              ועוד {queue.length - 1} הודעות מההנהלה
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {current.createdBy && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isReplying}
            onClick={() => reply(current)}
          >
            השבה להנהלה
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => void markRead(current.id)}>
          קראתי
        </Button>
      </div>
    </div>
  );
}
