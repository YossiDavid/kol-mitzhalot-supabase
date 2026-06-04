import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <p className="text-muted-foreground text-sm" dir="rtl">
        {message}
      </p>
      <p className="mt-4 text-sm">
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
        <CardTitle className="text-2xl">מצטערים, משהו השתבש.</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ErrorContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
