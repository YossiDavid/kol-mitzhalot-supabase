import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ContactShadchanDialog from "@/features/shadchanim/components/contact-shadchan-dialog";
import { ShadchanAvatar } from "@/features/shadchanim/components/shadchan-identity";
import {
  SHADCHAN_ACTION_LABELS,
  shadchanProfileHref,
  type ContactQuota,
  type ShadchanActionType,
  type ShadchanPublicCard,
} from "@/features/shadchanim/lib/types";
import { MessageSquare } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/** כמה תגיות התמחות מוצגות בכרטיס לכל היותר */
const MAX_SPECIALIZATION_CHIPS = 3;

type ShadchanCardProps = {
  shadchan: ShadchanPublicCard;
  quota: ContactQuota | null;
  /** When shown in "שדכנים שפעלו בשבילך" - what the shadchan did. */
  actionTypes?: ShadchanActionType[];
  /** תצוגה מקדימה בטופס השדכן: אותו כרטיס, בלי פעולות פעילות */
  isPreview?: boolean;
};

/** שורת המטא: "שדכן/ית משנת X · עיר", בלי החלקים החסרים */
function metaLine(shadchan: ShadchanPublicCard): string {
  return [
    shadchan.sinceYear ? `שדכן/ית משנת ${shadchan.sinceYear}` : null,
    shadchan.city,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * כרטיס שדכן ברשימה ובדשבורד. מבנה שורות קבוע (כותרת, מטא, תיאור קצוץ,
 * תגיות, פעולות בתחתית) כדי שכל הכרטיסים באותו גובה ושורות מתיישרות,
 * בלי תלות במה שהשדכן מילא.
 */
export default function ShadchanCard({
  shadchan,
  quota,
  actionTypes,
  isPreview = false,
}: ShadchanCardProps) {
  const chips = shadchan.specializations.slice(0, MAX_SPECIALIZATION_CHIPS);
  const meta = metaLine(shadchan);

  return (
    <Card size="sm" className="h-full" data-testid="shadchan-card">
      <div className="flex min-w-0 items-center gap-3">
        <ShadchanAvatar shadchan={shadchan} />
        <div className="min-w-0">
          <p className="truncate font-bold" data-testid="shadchan-card-name">
            {shadchan.name}
          </p>
          {/* min-h: השורה שומרת גובה גם כשאין מה להציג */}
          <p
            className="min-h-6 truncate text-body-sm text-muted-foreground"
            data-testid="shadchan-card-meta"
          >
            {meta}
          </p>
        </div>
      </div>

      {/* שלוש שורות קבועות; ריק משאיר את המקום ריק, בלי טקסט חלופי */}
      <p
        className="line-clamp-3 h-[4.35rem] text-body-sm"
        data-testid="shadchan-card-description"
      >
        {shadchan.description}
      </p>

      <ul
        className="flex h-6 flex-nowrap gap-1.5 overflow-hidden"
        aria-label={chips.length > 0 ? "התמחויות" : undefined}
        data-testid="shadchan-card-chips"
      >
        {chips.map((chip) => (
          <li key={chip} className="min-w-0">
            <Badge variant="secondary" className="max-w-full truncate">
              {chip}
            </Badge>
          </li>
        ))}
      </ul>

      {actionTypes && actionTypes.length > 0 && (
        <p className="text-body-sm text-muted-foreground">
          {actionTypes.map((type) => SHADCHAN_ACTION_LABELS[type]).join(" · ")}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        {isPreview ? (
          <>
            <Button variant="outline" className="flex-1" disabled>
              לפרופיל המלא
            </Button>
            <Button className="flex-1" disabled>
              פניה לשדכן
              <MessageSquare />
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" className="flex-1">
              <Link href={shadchanProfileHref(shadchan.id) as Route}>
                לפרופיל המלא
              </Link>
            </Button>
            <ContactShadchanDialog
              shadchanId={shadchan.id}
              shadchanName={shadchan.name}
              quota={quota}
              triggerClassName="flex-1"
            />
          </>
        )}
      </div>
    </Card>
  );
}
