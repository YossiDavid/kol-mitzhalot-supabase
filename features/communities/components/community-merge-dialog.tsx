"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormFields,
  FormGrid,
  FormSubmitError,
} from "@/components/ui/form-layout";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { CommunityRow } from "@/features/communities/lib/community-form-schema";
import {
  describeCommunityUsage,
  describeRowCount,
} from "@/features/communities/lib/community-usage";

const CHOOSE_BOTH_MESSAGE = "יש לבחור קהילת מקור וקהילת יעד";
const SAME_COMMUNITY_MESSAGE = "אי אפשר למזג קהילה לתוך עצמה";

type MergeFormProps = {
  communities: readonly CommunityRow[];
  initialSourceId: string | null;
  submitting: boolean;
  onCancel: () => void;
  onMerge: (source: CommunityRow, target: CommunityRow) => void;
};

/**
 * מיזוג כפילויות ("ויז׳ניץ" מול "וויזניץ"): הטקסט שבכרטיסים ובשורות ההשכלה
 * עובר משם המקור לשם היעד, וקהילת המקור נמחקת מהמאגר. הפעולה עצמה רצה
 * ב-RPC של מנהל (admin_merge_communities), כי היא נוגעת בנתוני המיועדים.
 */
export function CommunityMergeDialog({
  open,
  onOpenChange,
  communities,
  initialSourceId,
  submitting,
  onMerge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities: readonly CommunityRow[];
  initialSourceId: string | null;
  submitting: boolean;
  onMerge: (source: CommunityRow, target: CommunityRow) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מיזוג חסידויות וקהילות</DialogTitle>
          <DialogDescription>
            שני ערכים שהם אותה קהילה בכתיב שונה. הטקסט שבכרטיסים ובשורות ההשכלה
            יעבור לשם היעד, וקהילת המקור תימחק מהמאגר.
          </DialogDescription>
        </DialogHeader>

        {/*
          תוכן הדיאלוג יורד מה-DOM בכל סגירה, ולכן הבחירה מתאפסת מעצמה בפתיחה
          הבאה - בלי אפקט שמאפס מצב ומייצר רינדור נוסף.
        */}
        <MergeForm
          communities={communities}
          initialSourceId={initialSourceId}
          submitting={submitting}
          onCancel={() => onOpenChange(false)}
          onMerge={onMerge}
        />
      </DialogContent>
    </Dialog>
  );
}

function MergeForm({
  communities,
  initialSourceId,
  submitting,
  onCancel,
  onMerge,
}: MergeFormProps) {
  const [sourceId, setSourceId] = useState(initialSourceId ?? "");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const source = communities.find((row) => row.id === sourceId) ?? null;
  const target = communities.find((row) => row.id === targetId) ?? null;
  const showPreview = source !== null && target !== null && source !== target;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!source || !target) {
      setError(CHOOSE_BOTH_MESSAGE);
      return;
    }
    if (source.id === target.id) {
      setError(SAME_COMMUNITY_MESSAGE);
      return;
    }

    setError(null);
    onMerge(source, target);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormFields>
        <FormGrid>
          <div className="space-y-2">
            <Label htmlFor="mergeSource">קהילת מקור (תימחק)</Label>
            <NativeSelect
              id="mergeSource"
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              disabled={submitting}
            >
              <NativeSelectOption value="">בחירה</NativeSelectOption>
              {communities.map((community) => (
                <NativeSelectOption key={community.id} value={community.id}>
                  {community.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mergeTarget">קהילת יעד (תישאר)</Label>
            <NativeSelect
              id="mergeTarget"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              disabled={submitting}
            >
              <NativeSelectOption value="">בחירה</NativeSelectOption>
              {communities.map((community) => (
                <NativeSelectOption key={community.id} value={community.id}>
                  {community.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </FormGrid>

        {showPreview ? (
          <p
            data-slot="merge-preview"
            className="rounded-md border border-dashed p-3 text-body-sm text-muted-foreground"
          >
            {source.usageCount > 0
              ? `${describeRowCount(source.usageCount)} (${describeCommunityUsage(source)}) יעברו מ"${source.name}" ל"${target.name}".`
              : `"${source.name}" אינה מופיעה באף כרטיס, ולכן רק המאגר ישתנה.`}{" "}
            בסיום הערך &quot;{source.name}&quot; יימחק מהמאגר.
          </p>
        ) : null}

        <FormSubmitError>{error}</FormSubmitError>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            ביטול
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "ממזג..." : "מיזוג הקהילות"}
          </Button>
        </DialogFooter>
      </FormFields>
    </form>
  );
}
