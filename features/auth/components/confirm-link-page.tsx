import { Suspense } from "react";
import { redirect } from "next/navigation";

import { PageTitle } from "@/components/layout/page-header";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { ConfirmLinkForm } from "@/features/auth/components/confirm-link-form";
import { buildAuthErrorPath } from "@/features/auth/lib/auth-error";
import { sanitizeNextPath } from "@/features/auth/lib/next-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | null {
  const single = Array.isArray(value) ? value[0] : value;
  return single ? single : null;
}

async function ConfirmLinkContent({
  searchParams,
  pathNextPromise,
}: {
  searchParams: SearchParams;
  pathNextPromise?: Promise<string | null>;
}) {
  const [params, pathNext] = await Promise.all([
    searchParams,
    pathNextPromise ?? null,
  ]);
  const next = sanitizeNextPath(pathNext || firstValue(params.next));
  const nextForError = pathNext || firstValue(params.next) ? next : null;

  // הספק מחזיר שגיאה בקישור (קישור שנוצל/פג תוקף) כשהוא עצמו אימת את
  // הכתובת. אין כאן אסימון לצרוך, ולכן ההפניה לדף השגיאה בטוחה ב-GET.
  const providerError = firstValue(params.error);
  const providerDescription = firstValue(params.error_description);
  if (providerError || providerDescription) {
    redirect(
      buildAuthErrorPath({
        code: firstValue(params.error_code) ?? providerError,
        text: providerDescription ?? providerError,
        next: nextForError,
      }),
    );
  }

  const tokenHash = firstValue(params.token_hash);
  const code = firstValue(params.code);
  if (!tokenHash && !code) {
    redirect(
      buildAuthErrorPath({ code: "missing_params", next: nextForError }),
    );
  }

  const type = firstValue(params.type);
  const isSignup = type === "signup" || type === "invite";

  return (
    <Card>
      <CardHeader>
        <PageTitle>{isSignup ? "אישור הרשמה" : "כניסה למערכת"}</PageTitle>
        <CardDescription>
          {isSignup
            ? "לחצו על הכפתור כדי לאשר את כתובת המייל ולהיכנס למערכת."
            : "לחצו על הכפתור כדי להיכנס למערכת."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmLinkForm
          tokenHash={tokenHash}
          type={type}
          code={code}
          next={next}
          buttonLabel={isSignup ? "אישור וכניסה" : "לחצו כדי להיכנס למערכת"}
        />
      </CardContent>
    </Card>
  );
}

/**
 * מסך האישור שאליו מוביל הקישור במייל. ה-GET רק מציג כפתור; האסימון נצרך
 * בלחיצה (ראו confirm-email-link). זה מה שמגן מסורקי קישורים.
 *
 * `searchParams` נקרא מאחורי Suspense, כנדרש תחת Cache Components.
 */
export function ConfirmLinkPage({
  searchParams,
  pathNext,
}: {
  searchParams: SearchParams;
  /** היעד כשהגיע כסגמנטים של הנתיב (`/auth/confirm/app/...`) */
  pathNext?: Promise<string | null>;
}) {
  return (
    <Suspense
      fallback={
        <SkeletonRegion>
          <CardSkeleton fields={0} footer />
        </SkeletonRegion>
      }
    >
      <ConfirmLinkContent
        searchParams={searchParams}
        pathNextPromise={pathNext}
      />
    </Suspense>
  );
}
