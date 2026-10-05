/**
 * Callers: components/website/donations/use-donation-confirmation.ts.
 * מחזיר רק את הסטטוס. ה-uuid הבלתי ניתן לניחוש הוא ההרשאה, ולכן אין כאן PII.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  RETRY_AFTER_SECONDS,
  statusLimiter,
} from "@/features/donations/lib/rate-limits";

const idSchema = z.uuid();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!statusLimiter.allow(getClientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": RETRY_AFTER_SECONDS } },
    );
  }

  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const { data, error } = await createAdminClient()
      .from("donations")
      .select("status")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (error) {
      console.error(
        "[donations/status] read failed",
        describeSupabaseError(error),
      );
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!data)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { status: data.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[donations/status] unexpected error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
