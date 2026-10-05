import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * קישור לפתיחת קובץ ההסכמה בגודלו המלא בלשונית חדשה. התמונה בשורה ובטופס
 * קטנה וחתוכה, ולכן אי אפשר לקרוא בה את ההסכמה עצמה. רק תמונות (ה-bucket
 * דוחה PDF).
 */
export function EndorsementImageLink({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-body-sm font-medium text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      צפייה בקובץ
    </a>
  );
}
