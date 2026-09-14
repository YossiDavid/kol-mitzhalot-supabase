import { Box } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ContactShadchanDialog from "@/features/shadchanim/components/contact-shadchan-dialog";
import {
  ShadchanAvatar,
  ShadchanContactDetails,
} from "@/features/shadchanim/components/shadchan-identity";
import {
  getMyContactQuota,
  getShadchanPublicProfile,
} from "@/features/shadchanim/lib/queries";
import { ArrowRight } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

/** כמה תגיות מסומנות בשלד (התמחויות / שפות). */
const SKELETON_TAG_COUNT = 3;

function TagList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-body-sm font-bold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function statsLine(
  experienceYears: number | null,
  closedMatches: number | null,
) {
  const parts = [
    experienceYears ? `${experienceYears} שנות ניסיון` : null,
    closedMatches ? `${closedMatches} שידוכים שנסגרו` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function ShadchanProfileContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const [profile, quota] = await Promise.all([
    getShadchanPublicProfile(id),
    getMyContactQuota(),
  ]);

  if (!profile) notFound();

  const stats = statsLine(profile.experienceYears, profile.closedMatches);

  return (
    <Box className="flex flex-col gap-5 rounded-2xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ShadchanAvatar shadchan={profile} className="size-20" />
          <div className="min-w-0">
            <h1 className="truncate">{profile.name}</h1>
            {profile.sinceYear && (
              <p className="text-body-sm text-muted-foreground">
                שדכן משנת {profile.sinceYear}
              </p>
            )}
            {stats && <p className="text-body-sm">{stats}</p>}
          </div>
        </div>
        <ContactShadchanDialog
          shadchanId={profile.id}
          shadchanName={profile.name}
          quota={quota}
          triggerClassName="w-full sm:w-auto"
        />
      </div>

      <ShadchanContactDetails shadchan={profile} />

      {profile.description && (
        <div className="space-y-2">
          <h2 className="text-body font-bold">אודות</h2>
          <p className="whitespace-pre-line text-body-sm">
            {profile.description}
          </p>
        </div>
      )}

      <TagList title="התמחויות" items={profile.specializations} />
      <TagList title="שפות" items={profile.languages} />
    </Box>
  );
}

/** שלד כרטיס השדכן, באותו מבנה כדי שלא תהיה קפיצה. */
function ShadchanProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="טוען"
      className="flex flex-col gap-5 rounded-2xl border border-border p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="size-20 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>

      <Skeleton className="h-16 w-full rounded-xl" />

      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: SKELETON_TAG_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Full public profile of a shadchan ("לפרופיל המלא"). */
export default function ShadchanProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        חזרה ללוח הבקרה
      </Link>

      <Suspense fallback={<ShadchanProfileSkeleton />}>
        <ShadchanProfileContent params={params} />
      </Suspense>
    </div>
  );
}
