import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { forumWriteError, requireForumWriter } from "@/features/forums/lib/api";
import { FORUM_POST_MAX, FORUM_TITLE_MAX } from "@/features/forums/lib/types";

/**
 * פרסום פוסט בפורום השדכנים. הקריאה והרשימה נעשות ישירות מהדפים (שרת),
 * כך שנשאר כאן רק הפרסום. העמודה בטבלה היא content (לא body).
 */
const createSchema = z.object({
  title: z.string().trim().min(1).max(FORUM_TITLE_MAX),
  content: z.string().trim().min(1).max(FORUM_POST_MAX),
  categoryId: z.guid().nullish(),
});

export async function POST(req: NextRequest) {
  const writer = await requireForumWriter();
  if (!writer.ok) return writer.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "יש למלא כותרת ותוכן תקינים" },
      { status: 400 },
    );
  }

  const { data, error } = await writer.supabase
    .from("forum_posts")
    .insert({
      title: parsed.data.title,
      content: parsed.data.content,
      category_id: parsed.data.categoryId ?? null,
      author_id: writer.userId,
    })
    .select("id")
    .single();

  if (error) return forumWriteError("post", error);
  return NextResponse.json({ post: data }, { status: 201 });
}
