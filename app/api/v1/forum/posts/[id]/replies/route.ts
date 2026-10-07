import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { forumWriteError, requireForumWriter } from "@/features/forums/lib/api";
import { FORUM_REPLY_MAX } from "@/features/forums/lib/types";

const replySchema = z.object({
  content: z.string().trim().min(1).max(FORUM_REPLY_MAX),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const writer = await requireForumWriter();
  if (!writer.ok) return writer.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = replySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "יש לכתוב תגובה" }, { status: 400 });
  }

  const { data, error } = await writer.supabase
    .from("forum_replies")
    .insert({
      post_id: id,
      content: parsed.data.content,
      author_id: writer.userId,
    })
    .select("id")
    .single();

  if (error) return forumWriteError("reply", error);
  return NextResponse.json({ reply: data }, { status: 201 });
}
