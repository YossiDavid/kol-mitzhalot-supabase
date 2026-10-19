import { Page, PageTitle } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import ContactShadchanDialog from "@/features/shadchanim/components/contact-shadchan-dialog";
import {
  ShadchanAvatar,
  ShadchanContactDetails,
} from "@/features/shadchanim/components/shadchan-identity";
import {
  getMyContactQuota,
  getShadchanPublicProfile,
} from "@/features/shadchanim/lib/queries";
import { Button } from "@/components/ui/button";
import {
  formatShadchanTitle,
  shadchanRoleLabel,
} from "@/features/shadchanim/lib/gender";
import { getUser } from "@/lib/user";
import { ArrowRight, MapPin, Pencil } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

/** כמה תגיות מסומנות בשלד (התמחויות / שפות). */
const SKELETON_TAG_COUNT = 3;

function TagList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-body font-bold">{title}</h2>
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

/** פריטי "ניסיון ושידוכים": רק מה שיש לו ערך חיובי. */
function experienceItems(
  experienceYears: number | null,
  closedMatches: number | null,
) {
  return [
    experienceYears ? `${experienceYears} שנות ניסיון` : null,
    closedMatches ? `${closedMatches} שידוכים שנסגרו` : null,
  ].filter((item): item is string => item !== null);
}

/** סעיף עם כותרת קבועה, באותו סגנון בכל הפרופיל. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-body font-bold">{title}</h2>
      {children}
    </div>
  );
}

async function ShadchanProfileContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const [profile, quota, viewer] = await Promise.all([
    getShadchanPublicProfile(id),
    getMyContactQuota(),
    getUser(),
  ]);

  if (!profile) notFound();

  const experience = experienceItems(
    profile.experienceYears,
    profile.closedMatches,
  );
  // כפתור העריכה מוצג רק לבעל הפרופיל עצמו
  const isOwnProfile = viewer?.id === profile.id;
  const hasContactDetails = Boolean(profile.phone || profile.email);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ShadchanAvatar shadchan={profile} className="size-20" />
          <div className="min-w-0">
            <PageTitle className="truncate">
              {formatShadchanTitle(profile.name, profile.gender)}
            </PageTitle>
            {profile.sinceYear && (
              <p className="text-body-sm text-muted-foreground">
                {shadchanRoleLabel(profile.gender)} משנת {profile.sinceYear}
              </p>
            )}
            {profile.city && (
              <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {profile.city}
              </p>
            )}
          </div>
        </div>
        {isOwnProfile ? (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={"/app/settings/shadchan" as Route}>
              <Pencil aria-hidden />
              עריכת הפרופיל
            </Link>
          </Button>
        ) : (
          <ContactShadchanDialog
            shadchanId={profile.id}
            shadchanName={profile.name}
            quota={quota}
            triggerClassName="w-full sm:w-auto"
          />
        )}
      </div>

      {/* טלפון ואימייל מגיעים מה-DB רק לשדכן עצמו ולמנהל (אחרת null), לכן
          אין כאן בדיקת תפקיד: אין ערך - אין סעיף. */}
      {hasContactDetails ? (
        <Section title="פרטי התקשרות">
          <ShadchanContactDetails shadchan={profile} />
          <p className="text-body-sm text-muted-foreground">
            הטלפון והאימייל גלויים רק לך ולהנהלת האתר, ולא לשאר המשתמשים.
          </p>
        </Section>
      ) : (
        !isOwnProfile && (
          <p className="rounded-xl bg-muted/50 px-4 py-3 text-body-sm text-muted-foreground">
            ליצירת קשר עם {profile.name} יש להשתמש בכפתור &quot;פניה
            לשדכן&quot;.
          </p>
        )
      )}

      {profile.description && (
        <Section title="אודות">
          <p className="text-body-sm whitespace-pre-line">
            {profile.description}
          </p>
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="ניסיון ושידוכים">
          <ul className="space-y-1 text-body-sm">
            {experience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      <TagList title="התמחויות" items={profile.specializations} />
      <TagList title="שפות" items={profile.languages} />
    </Card>
  );
}

/** שלד כרטיס השדכן, באותו מבנה כדי שלא תהיה קפיצה. */
function ShadchanProfileSkeleton() {
  return (
    <SkeletonRegion>
      <Card aria-hidden>
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
      </Card>
    </SkeletonRegion>
  );
}

/** Full public profile of a shadchan ("לפרופיל המלא"). */
export default function ShadchanProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Page width="content">
      <Link
        href="/app/shadchanim"
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        חזרה לרשימת השדכנים
      </Link>

      <Suspense fallback={<ShadchanProfileSkeleton />}>
        <ShadchanProfileContent params={params} />
      </Suspense>
    </Page>
  );
}
