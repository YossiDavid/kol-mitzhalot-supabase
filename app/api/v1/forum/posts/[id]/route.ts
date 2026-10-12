import { NextRequest, NextResponse } from "next/server";
import {
  deleteForumRow,
  forumIdSchema,
  readJsonBody,
  updateForumRow,
} from "@/features/forums/lib/api";
import {
  FORUM_POST_INVALID_MESSAGE,
  forumPostFieldsSchema,
} from "@/features/forums/lib/schemas";

const INVALID_ID_RESPONSE = { error: "מזהה לא תקין" };

/**
 * עריכת פוסט בידי כותבו: כותרת, תוכן ונושא, באותה ולידציה כמו ביצירה. נכתבות
 * רק העמודות האלה (+ edited_at); author_id, is_pinned ושאר מה שבגוף הבקשה
 * מתעלמים ממנו.
 */
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
  const parsed = forumPostFieldsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: FORUM_POST_INVALID_MESSAGE },
      { status: 400 },
    );
  }

  return updateForumRow("forum_posts", id, {
    title: parsed.data.title,
    content: parsed.data.content,
    category_id: parsed.data.categoryId ?? null,
  });
}

/** מחיקת פוסט (כולל התגובות והלייקים שלו, ב-cascade) על ידי כותבו או מנהל */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!forumIdSchema.safeParse(id).success) {
    return NextResponse.json(INVALID_ID_RESPONSE, { status: 400 });
  }
  return deleteForumRow("forum_posts", id);
}
