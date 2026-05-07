import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHONE_VERIFICATION_SETTING_KEY } from "@/lib/system-settings";

/**
 * GET/PATCH phone verification module toggle. Admin only.
 */
export async function GET() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", PHONE_VERIFICATION_SETTING_KEY)
    .maybeSingle();

  if (error) {
    console.error("[phone-verification settings] GET", error);
    return NextResponse.json(
      { error: "Failed to load setting" },
      { status: 500 },
    );
  }

  const enabled = data?.value !== false;
  return NextResponse.json({ enabled });
}

export async function PATCH(req: NextRequest) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enabled =
    typeof body === "object" &&
    body !== null &&
    "enabled" in body &&
    typeof (body as { enabled: unknown }).enabled === "boolean"
      ? (body as { enabled: boolean }).enabled
      : undefined;

  if (enabled === undefined) {
    return NextResponse.json(
      { error: "Expected { enabled: boolean }" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("system_settings").upsert(
      {
        key: PHONE_VERIFICATION_SETTING_KEY,
        value: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      console.error("[phone-verification settings] PATCH", error);
      return NextResponse.json(
        { error: "Failed to save setting" },
        { status: 500 },
      );
    }

    return NextResponse.json({ enabled });
  } catch (e) {
    console.error("[phone-verification settings] PATCH admin client", e);
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }
}
