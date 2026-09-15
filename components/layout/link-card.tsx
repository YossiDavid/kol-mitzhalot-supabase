import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LinkCardProps<T extends string> = {
  /** גנרי כמו ב-next/link, כדי שנתיב דינמי (settings/[key]) יתקבל */
  href: Route<T>;
  icon: LucideIcon;
  title: string;
  description: string;
};

/** כרטיס ניווט: כל הכרטיס קישור (דפי הבית של הניהול, התוכן וההגדרות) */
export function LinkCard<T extends string>({
  href,
  icon: Icon,
  title,
  description,
}: LinkCardProps<T>) {
  return (
    <Card
      asChild
      className="h-full transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Link href={href}>
        <Icon className="size-8 text-primary" aria-hidden />
        <CardHeader>
          <CardTitle asChild>
            <h2>{title}</h2>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Link>
    </Card>
  );
}
