import { Suspense } from "react";

import { CopyEmailButton } from "@/features/contact-email/components/copy-email-button";
import { getContactEmail } from "@/features/contact-email/lib/get-contact-email";
import { cn } from "@/lib/utils";

/**
 * שורת "אימייל ליצירת קשר" בתחתית הדף: כתובת כקישור mailto וכפתור העתקה.
 * כשההגדרה ריקה (או שהקריאה נכשלה) לא מרונדר דבר - בלי שורה ריקה.
 */
async function ContactEmailRow({
  className,
  withToaster,
}: {
  className?: string;
  withToaster: boolean;
}) {
  const email = await getContactEmail();
  if (!email) return null;

  return (
    <div
      data-testid="footer-contact-email"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground",
        className,
      )}
    >
      <span>אימייל המערכת:</span>
      <a
        href={`mailto:${email}`}
        dir="ltr"
        className="rounded-sm text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {email}
      </a>
      <CopyEmailButton email={email} withToaster={withToaster} />
    </div>
  );
}

/** מאחורי Suspense כדי שהתחתית לא תחסום את הדף בזמן שליפת הערך */
export function ContactEmail({
  className,
  withToaster = false,
}: {
  className?: string;
  withToaster?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <ContactEmailRow className={className} withToaster={withToaster} />
    </Suspense>
  );
}
