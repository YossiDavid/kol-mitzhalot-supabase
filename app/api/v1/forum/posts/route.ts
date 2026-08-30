import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole } from "@/lib/user";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("forum_posts")
    .select(
      `id, title, body, created_at,
       author:user_profiles!forum_posts_author_id_fkey(first_name, last_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const admin = createAdminClient();
    const { data: fallback, error: err2 } = await admin
      .from("forum_posts")
      .select("id, title, body, created_at, author_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (err2) {
      return NextResponse.json({ error: err2.message }, { status: 500 });
    }
    return NextResponse.json({ posts: fallback ?? [] });
  }

  return NextResponse.json({ posts: data ?? [] });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user, "admin") && !hasRole(user, "shadchan")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("forum_posts")
    .insert({ title: parsed.data.title, body: parsed.data.body, author_id: user.id })
    .select("id, title, body, created_at, author_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
