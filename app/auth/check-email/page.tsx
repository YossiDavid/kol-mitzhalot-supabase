import { Suspense } from "react";
import Link from "next/link";

import { PageTitle } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EmailCodeForm } from "@/features/auth/components/email-code-form";
import { sanitizeNextPath, withNextParam } from "@/features/auth/lib/next-path";

type SearchParams = Promise<{ next?: string }>;

/**
 * `next` מגיע מטופס ההתחברות, כדי שגם הכניסה עם הקוד תחזיר ליעד המקורי.
 * נקרא מאחורי Suspense, כנדרש תחת Cache Components.
 */
async function CheckEmailContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;
  const safeNext = sanitizeNextPath(next);

  return (
    <CardContent className="flex flex-col gap-6">
      <p className="text-body-sm text-muted-foreground">
        לא קיבלת? בדוק בתיקיית ספאם או{" "}
        <Link
          href={withNextParam("/auth/login", safeNext)}
          className="underline underline-offset-4"
        >
          נסה שוב
        </Link>
        .
      </p>
      <EmailCodeForm next={safeNext} />
    </CardContent>
  );
}

export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Card>
      <CardHeader>
        <PageTitle>בדוק את האימייל שלך</PageTitle>
        <CardDescription>
          שלחנו לך מייל עם קישור להתחברות ועם קוד בן 6 ספרות. לחץ על הקישור כדי
          להיכנס, או הזן את הקוד כאן למטה.
        </CardDescription>
      </CardHeader>
      <Suspense fallback={<CardContent />}>
        <CheckEmailContent searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}
