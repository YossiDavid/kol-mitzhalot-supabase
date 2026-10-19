import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import { shadchanProfileHref } from "@/features/shadchanim/lib/types";

type ShadchanNameLinkProps = {
  shadchanId: string | null | undefined;
  name: string;
  className?: string;
};

/**
 * שם השדכן בדפי ההצעה, כקישור לדף השדכן (/app/shadchanim/[id]) - דף שפתוח
 * לכל משתמש מחובר. בלי מזהה (שדכן שנמחק) - השם בלבד.
 */
export default function ShadchanNameLink({
  shadchanId,
  name,
  className,
}: ShadchanNameLinkProps) {
  if (!shadchanId) return <span className={className}>{name}</span>;
  return (
    <Link
      href={shadchanProfileHref(shadchanId) as Route}
      className={cn("underline-offset-2 hover:underline", className)}
      data-testid="shadchan-name-link"
    >
      {name}
    </Link>
  );
}
