import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ContactShadchanDialog from "@/features/shadchanim/components/contact-shadchan-dialog";
import {
  ShadchanAvatar,
  ShadchanContactDetails,
} from "@/features/shadchanim/components/shadchan-identity";
import {
  SHADCHAN_ACTION_LABELS,
  shadchanProfileHref,
  type ContactQuota,
  type ShadchanActionType,
  type ShadchanPublicCard,
} from "@/features/shadchanim/lib/types";
import type { Route } from "next";
import Link from "next/link";

type ShadchanCardProps = {
  shadchan: ShadchanPublicCard;
  quota: ContactQuota | null;
  /** When shown in "שדכנים שפעלו בשבילך" - what the shadchan did. */
  actionTypes?: ShadchanActionType[];
};

/** Shadchan card per the dashboard design: header, contact row, bio, and "פניה לשדכן". */
export default function ShadchanCard({
  shadchan,
  quota,
  actionTypes,
}: ShadchanCardProps) {
  return (
    <Box className="flex h-full flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ShadchanAvatar shadchan={shadchan} />
          <div className="min-w-0">
            <p className="truncate font-bold">{shadchan.name}</p>
            {shadchan.sinceYear && (
              <p className="text-body-sm text-muted-foreground">
                שדכן משנת {shadchan.sinceYear}
              </p>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={shadchanProfileHref(shadchan.id) as Route}>
            לפרופיל המלא
          </Link>
        </Button>
      </div>

      <Separator />

      <ShadchanContactDetails shadchan={shadchan} />

      {shadchan.description && (
        <p className="line-clamp-3 text-body-sm">{shadchan.description}</p>
      )}

      {actionTypes && actionTypes.length > 0 && (
        <p className="text-body-sm text-muted-foreground">
          {actionTypes.map((type) => SHADCHAN_ACTION_LABELS[type]).join(" · ")}
        </p>
      )}

      <ContactShadchanDialog
        shadchanId={shadchan.id}
        shadchanName={shadchan.name}
        quota={quota}
        triggerClassName="mt-auto w-full"
      />
    </Box>
  );
}
