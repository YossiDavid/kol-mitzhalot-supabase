import { Badge } from "@/components/ui/badge";
import type { SideResponse } from "@/features/shidduchim/lib/proposals-data";
import {
  SHIDDUCH_RESPONSE_BADGE_VARIANT,
  SHIDDUCH_RESPONSE_LABELS,
  SHIDDUCH_SIDE_LABELS,
  SHIDDUCH_SIDES,
  formatDateTime,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";

type RecipientScope = "both" | "groom_only" | "bride_only" | null;

type SideResponsesPanelProps = {
  responses: readonly SideResponse[];
  recipientScope: RecipientScope;
};

function wasSentTo(side: ShidduchSide, scope: RecipientScope): boolean {
  return scope === "both" || scope === `${side}_only`;
}

/** תגובות הורי שני הצדדים, כפי שהשדכן (או מנהל) רואה אותן בכרטיס השידוך */
export default function SideResponsesPanel({
  responses,
  recipientScope,
}: SideResponsesPanelProps) {
  if (!recipientScope) return null;

  return (
    <div className="space-y-2">
      <p className="text-body-sm font-medium text-muted-foreground">
        תגובות הצדדים
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SHIDDUCH_SIDES.map((side) => {
          const response = responses.find((r) => r.side === side) ?? null;
          const isRecipient = wasSentTo(side, recipientScope);

          return (
            <div key={side} className="space-y-2 rounded-lg border p-3">
              <p className="text-body-sm font-semibold">
                {SHIDDUCH_SIDE_LABELS[side]}
              </p>
              {response ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={SHIDDUCH_RESPONSE_BADGE_VARIANT[response.response]}
                    >
                      {SHIDDUCH_RESPONSE_LABELS[response.response]}
                    </Badge>
                    <span className="text-caption text-muted-foreground">
                      {formatDateTime(response.respondedAt)}
                    </span>
                  </div>
                  {response.message && (
                    <p className="rounded-md bg-muted/50 p-2 text-body-sm whitespace-pre-wrap">
                      {response.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  {isRecipient
                    ? "טרם התקבלה תגובה"
                    : "ההצעה עדיין לא נשלחה לצד זה"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
