"use client";

import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TermsVersionHistory } from "@/features/auth/components/terms-version-history";
import {
  ALL_USERS_LABEL,
  describeTargetGroups,
  TERMS_TARGET_GROUP_LABELS,
  TERMS_TARGET_GROUPS,
  toggleTargetGroup,
  type TermsTargetGroup,
} from "@/features/auth/lib/terms-target-groups";

interface TermsVersionPanelProps {
  version: number;
  /**
   * שמירת התוכן ופרסום גרסה חדשה לקבוצות היעד (רשימה ריקה = כולם).
   * true = הצליח (הקורא כבר הציג הודעה)
   */
  onPublish: (targetGroups: TermsTargetGroup[]) => Promise<boolean>;
  isDisabled?: boolean;
}

function publishDescription(
  nextVersion: number,
  groups: readonly TermsTargetGroup[],
): string {
  const audience =
    groups.length === 0
      ? ALL_USERS_LABEL
      : `המשתמשים בקבוצות: ${describeTargetGroups(groups)}`;
  return `התוכן יישמר ויפורסם כגרסה ${nextVersion}. ${audience} (כולל מי שכבר אישר) יידרשו לאשר את התקנון מחדש לפני המשך פעילות במערכת. שאר המשתמשים לא ייחסמו.`;
}

/**
 * גרסת התקנון בעורך התוכן. "שמור" רגיל (תיקון ניסוח) אינו מחייב אישור
 * מחדש; רק פרסום גרסה חדשה כאן מחייב את קבוצות היעד לאשר שוב.
 */
export function TermsVersionPanel({
  version,
  onPublish,
  isDisabled = false,
}: TermsVersionPanelProps) {
  const idPrefix = useId();
  // ריק = כל המשתמשים
  const [groups, setGroups] = useState<TermsTargetGroup[]>([]);

  const handlePublish = async () => {
    const isPublished = await onPublish(groups);
    if (isPublished) setGroups([]);
    return isPublished;
  };

  return (
    <Box className="flex flex-col gap-4" data-testid="terms-version-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-bold">
            גרסה נוכחית: <span data-testid="terms-version">{version}</span>
          </p>
          <p className="text-body-sm text-muted-foreground">
            &quot;שמור&quot; מעדכן את הנוסח בלי לחייב אישור מחדש (מתאים לתיקון
            טעויות). שינוי מהותי - בחרו למי הוא מיועד ופרסמו גרסה חדשה; מי
            שבקבוצות שנבחרו יתבקש לאשר את התקנון שוב לפני המשך הפעילות.
          </p>
        </div>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" disabled={isDisabled}>
              פרסום גרסה חדשה – לחייב אישור מחדש
            </Button>
          }
          title="פרסום גרסה חדשה של התקנון"
          description={publishDescription(version + 1, groups)}
          confirmLabel="פרסום ושליחה לאישור"
          pendingLabel="מפרסם..."
          isDestructive={false}
          onConfirm={handlePublish}
        />
      </div>

      <fieldset className="space-y-2" disabled={isDisabled}>
        <legend className="mb-2 font-semibold">
          למי לשלוח את הגרסה החדשה לאישור
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-all`}
              checked={groups.length === 0}
              onCheckedChange={(checked) => {
                if (checked === true) setGroups([]);
              }}
            />
            <Label htmlFor={`${idPrefix}-all`} className="cursor-pointer">
              {ALL_USERS_LABEL}
            </Label>
          </div>
          {TERMS_TARGET_GROUPS.map((group) => (
            <div key={group} className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-${group}`}
                checked={groups.includes(group)}
                onCheckedChange={(checked) =>
                  setGroups((current) =>
                    toggleTargetGroup(current, group, checked === true),
                  )
                }
              />
              <Label
                htmlFor={`${idPrefix}-${group}`}
                className="cursor-pointer"
              >
                {TERMS_TARGET_GROUP_LABELS[group]}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-body-sm text-muted-foreground">
          &quot;משתמשים רגילים&quot; = מי שאינו שדכן, איש צוות או מנהל.
        </p>
      </fieldset>

      <TermsVersionHistory version={version} />
    </Box>
  );
}
