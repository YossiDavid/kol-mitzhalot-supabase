import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isShidduchStatus,
  SHIDDUCH_STATUS_LABELS,
  SHIDDUCH_STATUS_VALUES,
} from "@/features/shidduchim/lib/status";
import { getEffectiveRole } from "@/lib/user";

const bodySchema = z.object({
  shidduchId: z.string().uuid(),
  status: z.string(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getEffectiveRole(user);
  if (role !== "admin" && role !== "shadchan") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { shidduchId, status } = parsed.data;

  if (!isShidduchStatus(status)) {
    return NextResponse.json(
      {
        error: "Invalid status",
        allowed: SHIDDUCH_STATUS_VALUES,
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existing, error: fetchError } = await admin
    .from("shidduchim")
    .select("id, shadchan_id")
    .eq("id", shidduchId)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Shidduch not found" }, { status: 404 });
  }

  if (role !== "admin" && existing.shadchan_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error: updateError } = await admin
    .from("shidduchim")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shidduchId)
    .select("id, status, updated_at")
    .single();

  if (updateError || !updated) {
    console.error(updateError);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    row: updated,
    statusLabel: SHIDDUCH_STATUS_LABELS[status],
  });
}
