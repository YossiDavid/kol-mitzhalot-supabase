import { handleApplicationMessagePost } from "@/features/admin/lib/application-message-route";

/** שליחת הודעה חופשית ממנהל למבקש/ת בקשת הצטרפות (staff) */
export async function POST(req: Request) {
  return handleApplicationMessagePost(req, "staff");
}
