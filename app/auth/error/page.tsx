import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-header";
import { Suspense } from "react";
import Link from "next/link";

function decodeError(raw: string | undefined): string {
  if (!raw) return "אירעה שגיאה לא צוינה.";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = decodeError(params?.error);

  return (
    <>
      <p className="text-muted-foreground text-body-sm" dir="rtl">
        {message}
      </p>
      <p className="mt-4 text-body-sm">
        <Link href="/auth/login" className="underline underline-offset-4">
          בקשת קישור חדש / התחברות
        </Link>
      </p>
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <PageTitle>מצטערים, משהו השתבש.</PageTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ErrorContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
