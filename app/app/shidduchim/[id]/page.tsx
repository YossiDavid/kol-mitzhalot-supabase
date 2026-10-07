import { Box, PageHeader, PageHeaderSkeleton } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
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
import CandidateSummaryCard from "@/features/shidduchim/components/candidate-summary";
import {
  CANDIDATE_SUMMARY_SELECT,
  buildCandidateSummary,
  type CandidateSummaryRow,
} from "@/features/shidduchim/lib/candidate-summary";
import ClosedNoticesList from "@/features/shidduchim/components/closed-notices-list";
import DeleteShidduchButton from "@/features/shidduchim/components/delete-shidduch-button";
import InformOtherSideButton from "@/features/shidduchim/components/inform-other-side-button";
import {
  THIRD_PARTY_PROPOSAL_MESSAGE,
  isProposalsPending,
} from "@/features/students/lib/third-party-card";
import SendOtherSideButton from "@/features/shidduchim/components/send-other-side-button";
import ProposalThreadPanel from "@/features/shidduchim/components/proposal-thread-panel";
import SideResponsesPanel from "@/features/shidduchim/components/side-responses-panel";
import StatusSelector from "@/features/shidduchim/components/status-selector";
import {
  getMyProposals,
  getSideResponses,
} from "@/features/shidduchim/lib/proposals-data";
import { defaultNoticeSide } from "@/features/shidduchim/lib/closed-notice";
import { getClosedNotices } from "@/features/shidduchim/lib/closed-notices-data";
import {
  SHIDDUCH_SIDES,
  formatDateTime,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";

/** מועמד שהכרטיס שלו נמחק: הסיכום מציג רק את השם החלופי */
const EMPTY_CANDIDATE: CandidateSummaryRow = {
  first_name: null,
  last_name: null,
  nickname: null,
  gender: null,
  birth_date: null,
  personal_status: null,
  country: null,
  city: null,
  community: null,
  shtible: null,
  user_id: null,
  parents_father: null,
  parents_mother: null,
  parents_status: null,
  parents_dead: null,
};

// z.guid ולא z.uuid: החל מ-zod 4 המאמת של uuid בודק גם את ביטי הגרסה לפי
// RFC 4122, ומזהים תקינים לחלוטין במסד היו נופלים כאן ל-404.
const idSchema = z.guid();

/**
 * כרטיס שידוך. שתי תצוגות:
 * - שדכן בעל השידוך / מנהל: כלי ניהול (סטטוס, שליחה לצד השני), סיכום שני המועמדים
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
  const [{ data: groomRow }, { data: brideRow }, sideResponses, closedNotices] =
    await Promise.all([
      admin
        .from("students")
        .select(CANDIDATE_SUMMARY_SELECT)
        .eq("id", shidduch.groom_id)
        .is("deleted_at", null)
        .maybeSingle(),
      admin
        .from("students")
        .select(CANDIDATE_SUMMARY_SELECT)
        .eq("id", shidduch.bride_id)
        .is("deleted_at", null)
        .maybeSingle(),
      getSideResponses(supabase, [shidduch.id]),
      getClosedNotices(supabase, shidduch.id),
    ]);

  const viewer = { id: user.id, isAdmin };
  const groomSummary = buildCandidateSummary(
    groomRow ?? EMPTY_CANDIDATE,
    "המיועד",
    viewer,
  );
  const brideSummary = buildCandidateSummary(
    brideRow ?? EMPTY_CANDIDATE,
    "המיועדת",
    viewer,
  );
  const groomName = groomSummary.fullName;
  const brideName = brideSummary.fullName;
  const currentStatus: ShidduchStatus = isShidduchStatus(shidduch.status)
    ? shidduch.status
    : "draft";

  // "עדכון הצד השני": רלוונטי כשצד דחה (תגובת rejected) או שההצעה נדחתה/נסגרה
  // בסטטוס, ורק לצדדים שההצעה נשלחה אליהם בפועל.
  const recipientSides: ShidduchSide[] = SHIDDUCH_SIDES.filter(
    (side) =>
      shidduch.recipient_scope === "both" ||
      shidduch.recipient_scope === `${side}_only`,
  );
  const declinedSides: ShidduchSide[] = sideResponses
    .filter((r) => r.response === "rejected")
    .map((r) => r.side);
  const canInformOtherSide =
    recipientSides.length > 0 &&
    (declinedSides.length > 0 || currentStatus === "rejected");

  // צד שהמנהל שלו הוא המשתמש עצמו (שדכן שמנהל כרטיס בהצעה שלו) מטופל
  // למטה כתצוגת הורה, בלי שרשור כאן
  const threadSides = recipientSides.flatMap((side) => {
    const ownerId = side === "groom" ? groomRow?.user_id : brideRow?.user_id;
    return ownerId && ownerId !== user.id ? [{ side, ownerId }] : [];
  });

  const threadSideSet = new Set<ShidduchSide>(threadSides.map((t) => t.side));
  const sideNotes: Record<ShidduchSide, string | null> = {
    groom: shidduch.note_for_groom?.trim() ? shidduch.note_for_groom : null,
    bride: shidduch.note_for_bride?.trim() ? shidduch.note_for_bride : null,
  };

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

      <div
        className={
          threadSides.length > 0
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start"
            : undefined
        }
      >
        <Box className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <CandidateSummaryCard
              roleLabel="מיועד"
              studentId={groomRow ? shidduch.groom_id : null}
              summary={groomSummary}
            />
            <CandidateSummaryCard
              roleLabel="מיועדת"
              studentId={brideRow ? shidduch.bride_id : null}
              summary={brideSummary}
            />
          </div>

          <StatusSelector
            shidduchId={shidduch.id}
            initialStatus={currentStatus}
            canEdit
          />

          <SideResponsesPanel
            responses={sideResponses}
            recipientScope={shidduch.recipient_scope}
            threadOwnerIds={{
              // צד שהמנהל שלו הוא המשתמש עצמו מטופל בתצוגת ההורה, בלי פאנל כאן
              groom:
                groomRow?.user_id && groomRow.user_id !== user.id
                  ? groomRow.user_id
                  : undefined,
              bride:
                brideRow?.user_id && brideRow.user_id !== user.id
                  ? brideRow.user_id
                  : undefined,
            }}
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
            blockedReason={
              isProposalsPending(groomRow ?? {}) ||
              isProposalsPending(brideRow ?? {})
                ? THIRD_PARTY_PROPOSAL_MESSAGE
                : null
            }
          />

          {canInformOtherSide && (
            <InformOtherSideButton
              shidduchId={shidduch.id}
              recipientSides={recipientSides}
              defaultSide={defaultNoticeSide(recipientSides, declinedSides)}
            />
          )}
          <ClosedNoticesList notices={closedNotices} />

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

          {/* הערה לצד שאין לו שרשור כאן נשארת בכרטיס, כדי שלא תיעלם */}
          {SHIDDUCH_SIDES.filter((side) => !threadSideSet.has(side)).map(
            (side) =>
              sideNotes[side] && (
                <div key={side}>
                  <p className="mb-1 text-body-sm font-medium text-muted-foreground">
                    {side === "groom"
                      ? "הערות לצד המיועד"
                      : "הערות לצד המיועדת"}
                  </p>
                  <div className="rounded-lg border bg-muted/50 p-3 text-body-sm whitespace-pre-wrap">
                    {sideNotes[side]}
                  </div>
                </div>
              ),
          )}

          <p className="text-caption text-muted-foreground">
            נוצר: {formatDateTime(shidduch.created_at)}
          </p>
        </Box>

        {/* שרשור מלא מול כל צד שההצעה נשלחה אליו, בעמודת צד דביקה במסך רחב
            (ומתחת לפרטים במובייל), כדי שהשיחות ייראו בלי גלילה */}
        {threadSides.length > 0 && (
          <aside
            id="proposal-thread"
            aria-label="שיחות על ההצעה"
            className="scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
          >
            <Box className="space-y-2">
              {threadSides.map(({ side, ownerId }) => (
                <ProposalThreadPanel
                  key={side}
                  shidduchId={shidduch.id}
                  otherUserId={ownerId}
                  withLabel={side === "groom" ? "צד החתן" : "צד הכלה"}
                  openingNote={
                    sideNotes[side]
                      ? {
                          text: sideNotes[side],
                          sentAt: shidduch.sent_at,
                          fromLabel: "השדכן",
                        }
                      : undefined
                  }
                />
              ))}
            </Box>
          </aside>
        )}
      </div>

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

/** שלד כרטיס השידוך: כותרת, סיכום שני המועמדים, ואזורי הסטטוס וההערות. */
function ShidduchCardSkeleton() {
  return (
    <SkeletonRegion className="space-y-6">
      <PageHeaderSkeleton description={false} actions={1} />

      <Box aria-hidden className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44" />
            </div>
          ))}
        </div>

        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full rounded-lg" />

        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>

        <Skeleton className="h-3 w-48" />
      </Box>
    </SkeletonRegion>
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
