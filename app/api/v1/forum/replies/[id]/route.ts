import { NextRequest, NextResponse } from "next/server";
import {
  deleteForumRow,
  forumIdSchema,
  readJsonBody,
  updateForumRow,
} from "@/features/forums/lib/api";
import {
  FORUM_REPLY_INVALID_MESSAGE,
  forumReplyFieldsSchema,
} from "@/features/forums/lib/schemas";

const INVALID_ID_RESPONSE = { error: "מזהה לא תקין" };

/** עריכת תגובה בידי כותבה: התוכן בלבד, באותה ולידציה כמו ביצירה */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!forumIdSchema.safeParse(id).success) {
    return NextResponse.json(INVALID_ID_RESPONSE, { status: 400 });
  }

  const payload = await readJsonBody(req);
  if (payload === null) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = forumReplyFieldsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: FORUM_REPLY_INVALID_MESSAGE },
      { status: 400 },
    );
  }

  return updateForumRow("forum_replies", id, { content: parsed.data.content });
}

/** מחיקת תגובה (והלייקים שלה, ב-cascade) על ידי כותבה או מנהל */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!forumIdSchema.safeParse(id).success) {
    return NextResponse.json(INVALID_ID_RESPONSE, { status: 400 });
  }
  return deleteForumRow("forum_replies", id);
}
