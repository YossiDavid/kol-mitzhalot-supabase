import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isShidduchStatus,
  type ShidduchStatus,
} from "@/features/shidduchim/lib/status";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import SendOtherSideButton from "@/features/shidduchim/components/send-other-side-button";
import StatusSelector from "@/features/shidduchim/components/status-selector";

function fullName(
  row: { first_name: string | null; last_name: string | null } | null,
  fallback: string,
) {
  if (!row) return fallback;
  const s = `${row.first_name || ""} ${row.last_name || ""}`.trim();
  return s || fallback;
}

export default async function ShidduchCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: shidduch, error } = await supabase
    .from("shidduchim")
    .select(
      `
      id,
      status,
      shadchan_id,
      groom_id,
      bride_id,
      note_for_groom,
      note_for_bride,
      recipient_scope,
      sent_at,
      created_at,
      updated_at
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !shidduch) {
    notFound();
  }

  const role = getEffectiveRole(user);
  const canEditStatus = role === "admin" || shidduch.shadchan_id === user.id;
  const canLoadBothNames =
    role === "admin" || shidduch.shadchan_id === user.id;

  type NameRow = { first_name: string | null; last_name: string | null };

  let groomRow: NameRow | null = null;
  let brideRow: NameRow | null = null;

  if (canLoadBothNames) {
    const admin = createAdminClient();
    const [{ data: g }, { data: b }] = await Promise.all([
      admin
        .from("students")
        .select("first_name, last_name")
        .eq("id", shidduch.groom_id)
        .maybeSingle(),
      admin
        .from("students")
        .select("first_name, last_name")
        .eq("id", shidduch.bride_id)
        .maybeSingle(),
    ]);
    groomRow = g;
    brideRow = b;
  } else {
    const [{ data: g }, { data: b }] = await Promise.all([
      supabase
        .from("students")
        .select("first_name, last_name")
        .eq("id", shidduch.groom_id)
        .maybeSingle(),
      supabase
        .from("students")
        .select("first_name, last_name")
        .eq("id", shidduch.bride_id)
        .maybeSingle(),
    ]);
    groomRow = g;
    brideRow = b;
  }

  const groomName = fullName(groomRow, "המיועד");
  const brideName = fullName(brideRow, "המיועדת");
  const currentStatus: ShidduchStatus = isShidduchStatus(shidduch.status)
    ? shidduch.status
    : "draft";

  const scopeLabel =
    shidduch.recipient_scope === "both"
      ? "נשלח לשני הצדדים"
      : shidduch.recipient_scope === "groom_only"
        ? "נשלח למנהל המיועד בלבד"
        : shidduch.recipient_scope === "bride_only"
          ? "נשלח למנהל המיועדת בלבד"
          : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">כרטיס שידוך</h1>
        <Button variant="outline" asChild>
          <Link href="/app">חזרה לאפליקציה</Link>
        </Button>
      </div>

      <Box className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm font-medium">מיועד</p>
            <p className="text-lg font-semibold">{groomName}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">מיועדת</p>
            <p className="text-lg font-semibold">{brideName}</p>
          </div>
        </div>

        <StatusSelector
          shidduchId={shidduch.id}
          initialStatus={currentStatus}
          canEdit={canEditStatus}
        />

        {scopeLabel && (
          <div>
            <p className="text-muted-foreground text-sm font-medium">היקף שליחה</p>
            <p className="text-sm">{scopeLabel}</p>
          </div>
        )}
        <SendOtherSideButton
          shidduchId={shidduch.id}
          recipientScope={shidduch.recipient_scope}
          canEdit={canEditStatus}
        />

        {shidduch.sent_at && (
          <div>
            <p className="text-muted-foreground text-sm font-medium">נשלח למייל</p>
            <p className="text-sm">
              {new Date(shidduch.sent_at).toLocaleString("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
        )}

        {shidduch.note_for_groom?.trim() && (
          <div>
            <p className="text-muted-foreground mb-1 text-sm font-medium">
              הערות לצד המיועד
            </p>
            <div className="bg-muted/50 rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {shidduch.note_for_groom}
            </div>
          </div>
        )}

        {shidduch.note_for_bride?.trim() && (
          <div>
            <p className="text-muted-foreground mb-1 text-sm font-medium">
              הערות לצד המיועדת
            </p>
            <div className="bg-muted/50 rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {shidduch.note_for_bride}
            </div>
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          נוצר:{" "}
          {new Date(shidduch.created_at).toLocaleString("he-IL", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </Box>
    </div>
  );
}
