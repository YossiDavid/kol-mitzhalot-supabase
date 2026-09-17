import { Suspense } from "react";

import { CardSkeleton } from "@/components/ui/card-skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";

/**
 * `next` מגיע מההפניה ב-app/app/layout.tsx כשמשתמש לא מחובר ניסה להגיע
 * לעמוד פנימי — למשל קישור להצעת שידוך ממייל. הוא עובר לטופס, שמטמיע אותו
 * בקישור ההתחברות שנשלח במייל.
 *
 * הקריאה ל-searchParams יושבת מאחורי Suspense (כמו ב-app/app/settings):
 * תחת Cache Components גישה אליה מחוץ לגבול חוסמת את ה-prerender של העמוד.
 */
async function LoginFormWithNext({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next ?? null} />;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <SkeletonRegion>
          <CardSkeleton fields={1} footer />
        </SkeletonRegion>
      }
    >
      <LoginFormWithNext searchParams={searchParams} />
    </Suspense>
  );
}
