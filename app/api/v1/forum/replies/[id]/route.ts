import { NextRequest, NextResponse } from "next/server";
import { deleteForumRow, forumIdSchema } from "@/features/forums/lib/api";

/** מחיקת תגובה (והלייקים שלה, ב-cascade) על ידי כותבה או מנהל */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!forumIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "מזהה לא תקין" }, { status: 400 });
  }
  return deleteForumRow("forum_replies", id);
}
