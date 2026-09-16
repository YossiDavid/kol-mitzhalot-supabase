"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CommunityRow } from "@/features/communities/lib/community-form-schema";
import { describeCommunityUsage } from "@/features/communities/lib/community-usage";

/**
 * אישור מחיקה של ערך מהמאגר.
 *
 * הכלל: ערך שאינו מופיע באף כרטיס נמחק; ערך שנמצא בשימוש אינו נמחק כלל -
 * מחיקה הייתה משאירה כרטיסים עם טקסט שאינו במאגר. במקומה מוצעות שתי הדרכים
 * הבטוחות: סימון כלא פעילה (הערך נשאר בכרטיסים ואינו מוצע לבחירה חדשה), או
 * מיזוג לקהילה אחרת (הטקסט בכרטיסים עובר, והערך נמחק). אותו כלל נאכף גם
 * במסד, בטריגר communities_block_delete_in_use.
 */
export function CommunityDeleteDialog({
  open,
  onOpenChange,
  community,
  submitting,
  onConfirmDelete,
  onDeactivate,
  onMerge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  community: CommunityRow | null;
  submitting: boolean;
  onConfirmDelete: (community: CommunityRow) => void;
  onDeactivate: (community: CommunityRow) => void;
  onMerge: (community: CommunityRow) => void;
}) {
  if (!community) return null;

  const isInUse = community.usageCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isInUse ? "הקהילה נמצאת בשימוש" : "מחיקת חסידות או קהילה"}
          </DialogTitle>
          <DialogDescription>
            {isInUse
              ? `"${community.name}" מופיעה ב-${describeCommunityUsage(community)}. מחיקה הייתה משאירה את הכרטיסים עם ערך שאינו במאגר, ולכן היא חסומה.`
              : `למחוק את "${community.name}" מהמאגר? הערך אינו מופיע באף כרטיס, ולכן המחיקה אינה משנה נתונים קיימים.`}
          </DialogDescription>
        </DialogHeader>

        {isInUse ? (
          <p className="text-body-sm text-muted-foreground">
            אפשר לסמן את הקהילה כלא פעילה - היא תישאר בכרטיסים הקיימים ולא תוצע
            לבחירה חדשה - או למזג אותה לקהילה אחרת, וכך גם הטקסט שבכרטיסים
            יעבור.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            ביטול
          </Button>

          {isInUse ? (
            <>
              {community.is_active ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDeactivate(community)}
                  disabled={submitting}
                >
                  סימון כלא פעילה
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => onMerge(community)}
                disabled={submitting}
              >
                מיזוג לקהילה אחרת
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onConfirmDelete(community)}
              disabled={submitting}
            >
              {submitting ? "מוחק..." : "מחיקה"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
