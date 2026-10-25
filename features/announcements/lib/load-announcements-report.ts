import { createAdminClient } from "@/lib/supabase/admin";
import type { AnnouncementAudience } from "@/features/announcements/lib/announcements";

export type AnnouncementReader = { userId: string; name: string; readAt: string };

export type AnnouncementReportRow = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  isActive: boolean;
  createdAt: string;
  readers: AnnouncementReader[];
};

const REPORT_LIMIT = 50;

/** הודעות המערכת האחרונות ומי קרא כל אחת. service role - דף מנהל בלבד */
export async function loadAnnouncementsReport(): Promise<AnnouncementReportRow[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("system_announcements")
    .select("id, title, body, audience, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(REPORT_LIMIT);
  if (error) throw new Error(`[announcements/report] ${error.message}`);
  const ids = (rows ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data: reads, error: readsError } = await admin
    .from("system_announcement_reads")
    .select("announcement_id, user_id, read_at")
    .in("announcement_id", ids)
    .order("read_at", { ascending: false });
  if (readsError) throw new Error(`[announcements/report] ${readsError.message}`);

  const userIds = [...new Set((reads ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await admin
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", userIds)
    : { data: [] };
  const nameById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ") || "ללא שם",
    ]),
  );

  return (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience as AnnouncementAudience,
    isActive: row.is_active,
    createdAt: row.created_at,
    readers: (reads ?? [])
      .filter((r) => r.announcement_id === row.id)
      .map((r) => ({
        userId: r.user_id,
        name: nameById.get(r.user_id) ?? "ללא שם",
        readAt: r.read_at,
      })),
  }));
}
