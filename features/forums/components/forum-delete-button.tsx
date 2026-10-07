"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteTarget =
  | { kind: "post"; id: string; replyCount: number }
  | { kind: "reply"; id: string };

/** פוסט נמחק עם כל תגובותיו, ולכן ההודעה מציינת כמה תגובות יימחקו */
function describeRemoval(target: DeleteTarget): string {
  if (target.kind === "reply") return "התגובה תימחק ולא ניתן יהיה לשחזר אותה.";
  if (target.replyCount === 0) {
    return "הפוסט יימחק ולא ניתן יהיה לשחזר אותו.";
  }
  const replies =
    target.replyCount === 1 ? "תגובה אחת" : `${target.replyCount} תגובות`;
  return `הפוסט וכל התגובות אליו יימחקו (${replies}) ולא ניתן יהיה לשחזר אותם.`;
}

/**
 * כפתור מחיקה עם דיאלוג אישור, לפוסט או לתגובה. מוצג רק למי שהמחיקה מותרת
 * לו (כותב התוכן או מנהל); ה-RLS הוא האוכף האמיתי.
 * redirectTo: לאן לעבור אחרי מחיקה (עמוד הפוסט שנמחק); בלעדיו הדף מתרענן.
 */
export default function ForumDeleteButton({
  target,
  redirectTo,
  size = "sm",
}: {
  target: DeleteTarget;
  redirectTo?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const isPost = target.kind === "post";
  const noun = isPost ? "פוסט" : "תגובה";
  const url = isPost
    ? `/api/v1/forum/posts/${target.id}`
    : `/api/v1/forum/replies/${target.id}`;

  async function confirmDelete() {
    setIsPending(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `מחיקת ה${noun} נכשלה, נסו שוב`);
        return;
      }
      toast.success(isPost ? "הפוסט נמחק" : "התגובה נמחקה");
      setIsOpen(false);
      if (redirectTo) router.replace(redirectTo as never);
      else router.refresh();
    } catch {
      toast.error(`מחיקת ה${noun} נכשלה, נסו שוב`);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={() => setIsOpen(true)}
        aria-label={`מחיקת ה${noun}`}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
        <span>מחיקה</span>
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !isPending && setIsOpen(open)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{isPost ? "מחיקת פוסט" : "מחיקת תגובה"}</DialogTitle>
            <DialogDescription>{describeRemoval(target)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? "מוחק..." : `מחיקת ה${noun}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
