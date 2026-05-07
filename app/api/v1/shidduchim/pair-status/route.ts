import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groomId = req.nextUrl.searchParams.get("groomId");
  const brideId = req.nextUrl.searchParams.get("brideId");

  if (!groomId || !brideId) {
    return NextResponse.json(
      { error: "חסרים groomId / brideId" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shidduchim")
    .select("id, status, shadchan_id, sent_at, created_at")
    .eq("groom_id", groomId)
    .eq("bride_id", brideId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}
