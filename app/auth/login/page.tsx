import { Suspense } from "react";

import { CardSkeleton } from "@/components/ui/card-skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";
import {
  IDLE_LOGOUT_LOGIN_MESSAGE,
  IDLE_LOGOUT_REASON,
} from "@/features/idle-logout/lib/idle-logout-model";

/**
 * `next` מגיע מההפניה ב-app/app/layout.tsx כשמשתמש לא מחובר ניסה להגיע
 * לעמוד פנימי — למשל קישור להצעת שידוך ממייל. הוא עובר לטופס, שמטמיע אותו
 * בקישור ההתחברות שנשלח במייל.
 *
 * `reason=idle` מגיע מההתנתקות האוטומטית אחרי חוסר פעילות: מוצגת הודעה עדינה.
 *
 * הקריאה ל-searchParams יושבת מאחורי Suspense (כמו ב-app/app/settings):
 * תחת Cache Components גישה אליה מחוץ לגבול חוסמת את ה-prerender של העמוד.
 */
async function LoginFormWithNext({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  return (
    <LoginForm
      next={next ?? null}
      notice={reason === IDLE_LOGOUT_REASON ? IDLE_LOGOUT_LOGIN_MESSAGE : null}
    />
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
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
