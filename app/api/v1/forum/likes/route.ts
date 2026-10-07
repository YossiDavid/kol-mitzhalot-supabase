import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { forumWriteError, requireForumWriter } from "@/features/forums/lib/api";

/** לייק לפוסט או לתגובה (בדיוק אחד מהם), ובטלו כש-liked=false */
const likeSchema = z
  .object({
    postId: z.guid().optional(),
    replyId: z.guid().optional(),
    liked: z.boolean(),
  })
  .refine((value) => Boolean(value.postId) !== Boolean(value.replyId), {
    message: "יש לציין פוסט או תגובה",
  });

export async function PUT(req: NextRequest) {
  const writer = await requireForumWriter();
  if (!writer.ok) return writer.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = likeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const { postId, replyId, liked } = parsed.data;
  const targetColumn = postId ? "post_id" : "reply_id";
  const targetId = (postId ?? replyId) as string;

  if (liked) {
    // upsert: לחיצה כפולה (או מירוץ בין לשוניות) אינה שגיאת unique
    const { error } = await writer.supabase.from("forum_likes").upsert(
      { user_id: writer.userId, [targetColumn]: targetId },
      {
        onConflict: `user_id,${targetColumn}`,
        ignoreDuplicates: true,
      },
    );
    if (error) return forumWriteError("like", error);
  } else {
    const { error } = await writer.supabase
      .from("forum_likes")
      .delete()
      .eq("user_id", writer.userId)
      .eq(targetColumn, targetId);
    if (error) return forumWriteError("unlike", error);
  }

  return NextResponse.json({ liked });
}
