import { Box, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isShidduchStatus,
  type ShidduchStatus,
} from "@/features/shidduchim/lib/status";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import ParentProposalView from "@/features/shidduchim/components/parent-proposal-view";
import DeleteShidduchButton from "@/features/shidduchim/components/delete-shidduch-button";
import SendOtherSideButton from "@/features/shidduchim/components/send-other-side-button";
import SideResponsesPanel from "@/features/shidduchim/components/side-responses-panel";
import StatusSelector from "@/features/shidduchim/components/status-selector";
import {
  getMyProposals,
  getSideResponses,
} from "@/features/shidduchim/lib/proposals-data";
import { formatDateTime } from "@/features/shidduchim/lib/responses";

function fullName(
  row: { first_name: string | null; last_name: string | null } | null,
  fallback: string,
) {
  if (!row) return fallback;
  const s = `${row.first_name || ""} ${row.last_name || ""}`.trim();
  return s || fallback;
}

// z.guid ולא z.uuid: החל מ-zod 4 המאמת של uuid בודק גם את ביטי הגרסה לפי
// RFC 4122, ומזהים תקינים לחלוטין במסד היו נופלים כאן ל-404.
const idSchema = z.guid();

/**
 * כרטיס שידוך. שתי תצוגות:
 * - שדכן בעל השידוך / מנהל: כלי ניהול (סטטוס, שליחה לצד השני, שתי ההערות)
 *   ותגובות שני הצדדים.
 * - מנהל כרטיס (הורה) שההצעה נשלחה לצד שלו: ההצעה עם ההערה לצד שלו בלבד,
 *   ותגובה לשדכן. זה גם היעד של הקישור במייל ההצעה.
 *
 * הכותרת וכפתור החזרה תלויים בתצוגה שנבחרת, ולכן כל הדף יושב מאחורי הגבול.
 */
async function ShidduchCardContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const [{ data: shidduch }, parentProposals] = await Promise.all([
    supabase
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
      .maybeSingle(),
    getMyProposals(supabase, { shidduchId: id }),
  ]);

  const isAdmin = hasRole(user, "admin");
  const isManager = !!shidduch && (isAdmin || shidduch.shadchan_id === user.id);

  if (!isManager) {
    if (parentProposals.length === 0) {
      notFound();
    }
    return (
      <div className="space-y-6">
        <PageHeader
          title="הצעת שידוך"
          actions={
            <Button variant="outline" asChild>
              <Link href="/app/proposals">לכל ההצעות</Link>
            </Button>
          }
        />
        {parentProposals.map((proposal) => (
          <ParentProposalView
            key={proposal.side}
            proposal={proposal}
            viewerId={user.id}
          />
        ))}
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: groomRow }, { data: brideRow }, sideResponses] =
    await Promise.all([
      admin
        .from("students")
        .select("first_name, last_name")
        .eq("id", shidduch.groom_id)
        .is("deleted_at", null)
        .maybeSingle(),
      admin
        .from("students")
        .select("first_name, last_name")
        .eq("id", shidduch.bride_id)
        .is("deleted_at", null)
        .maybeSingle(),
      getSideResponses(supabase, [shidduch.id]),
    ]);

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
      <PageHeader
        title="כרטיס שידוך"
        actions={
          <Button variant="outline" asChild>
            <Link href="/app">חזרה לאפליקציה</Link>
          </Button>
        }
      />

      <Box className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-body-sm font-medium text-muted-foreground">
              מיועד
            </p>
            <p className="text-subtitle font-semibold">{groomName}</p>
          </div>
          <div>
            <p className="text-body-sm font-medium text-muted-foreground">
              מיועדת
            </p>
            <p className="text-subtitle font-semibold">{brideName}</p>
          </div>
        </div>

        <StatusSelector
          shidduchId={shidduch.id}
          initialStatus={currentStatus}
          canEdit
        />

        <SideResponsesPanel
          responses={sideResponses}
          recipientScope={shidduch.recipient_scope}
        />

        {scopeLabel && (
          <div>
            <p className="text-body-sm font-medium text-muted-foreground">
              היקף שליחה
            </p>
            <p className="text-body-sm">{scopeLabel}</p>
          </div>
        )}
        <SendOtherSideButton
          shidduchId={shidduch.id}
          recipientScope={shidduch.recipient_scope}
          canEdit
        />

        {/* מחיקה מותרת רק לשדכן שיצר את ההצעה — כך גם מדיניות ה-RLS,
            ולכן אין להציג את הכפתור למנהל שצופה בהצעה של אחר */}
        {shidduch.shadchan_id === user.id && (
          <DeleteShidduchButton
            shidduchId={shidduch.id}
            pairLabel={`${groomName} - ${brideName}`}
            wasSent={!!shidduch.sent_at}
          />
        )}

        {shidduch.sent_at && (
          <div>
            <p className="text-body-sm font-medium text-muted-foreground">
              נשלח למייל
            </p>
            <p className="text-body-sm">{formatDateTime(shidduch.sent_at)}</p>
          </div>
        )}

        {shidduch.note_for_groom?.trim() && (
          <div>
            <p className="mb-1 text-body-sm font-medium text-muted-foreground">
              הערות לצד המיועד
            </p>
            <div className="rounded-lg border bg-muted/50 p-3 text-body-sm whitespace-pre-wrap">
              {shidduch.note_for_groom}
            </div>
          </div>
        )}

        {shidduch.note_for_bride?.trim() && (
          <div>
            <p className="mb-1 text-body-sm font-medium text-muted-foreground">
              הערות לצד המיועדת
            </p>
            <div className="rounded-lg border bg-muted/50 p-3 text-body-sm whitespace-pre-wrap">
              {shidduch.note_for_bride}
            </div>
          </div>
        )}

        <p className="text-caption text-muted-foreground">
          נוצר: {formatDateTime(shidduch.created_at)}
        </p>
      </Box>

      {/* שדכן/מנהל שהוא גם מנהל כרטיס באחד הצדדים מגיב כאן כהורה */}
      {parentProposals.map((proposal) => (
        <ParentProposalView
          key={proposal.side}
          proposal={proposal}
          viewerId={user.id}
        />
      ))}
    </div>
  );
}

/** שלד כרטיס השידוך: כותרת, שמות שני הצדדים, ואזורי הסטטוס וההערות. */
function ShidduchCardSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="space-y-6 rounded-xl border border-border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-40" />
          </div>
        </div>

        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full rounded-lg" />

        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>

        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export default function ShidduchCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ShidduchCardSkeleton />}>
      <ShidduchCardContent params={params} />
    </Suspense>
  );
}
