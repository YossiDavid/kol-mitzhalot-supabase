import { Suspense } from "react";
import Link from "next/link";

import { PageTitle } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmailCodeForm } from "@/features/auth/components/email-code-form";
import { describeAuthError } from "@/features/auth/lib/auth-error";
import { sanitizeNextPath, withNextParam } from "@/features/auth/lib/next-path";

type SearchParams = Promise<{ error?: string; code?: string; next?: string }>;

/**
 * הטקסט שב-`?error=` הוא טקסט של הספק ונשלט על ידי מי שיצר את הקישור: הוא
 * משמש רק לזיהוי סוג השגיאה ואינו מוצג. ההסברים כולם בעברית וקבועים בקוד.
 */
async function ErrorContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const info = describeAuthError({ code: params?.code, text: params?.error });
  const next = sanitizeNextPath(params?.next);

  const newLinkHref =
    info.kind === "signupDisabled"
      ? "/auth/sign-up"
      : withNextParam("/auth/login", next);
  const newLinkLabel =
    info.kind === "signupDisabled" ? "להרשמה" : "בקשת קישור חדש";

  return (
    <CardContent className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-semibold">{info.title}</p>
        <p className="text-body-sm text-muted-foreground">{info.message}</p>
      </div>
      {info.offerCode ? <EmailCodeForm next={next} /> : null}
      {info.kind === "signupDisabled" || info.offerNewLink ? (
        <Button asChild variant={info.offerCode ? "outline" : "default"}>
          <Link href={newLinkHref}>{newLinkLabel}</Link>
        </Button>
      ) : null}
    </CardContent>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Card>
      <CardHeader>
        <PageTitle>מצטערים, משהו השתבש.</PageTitle>
      </CardHeader>
      <Suspense fallback={<CardContent />}>
        <ErrorContent searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}
