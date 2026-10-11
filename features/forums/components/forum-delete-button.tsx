"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
 * variant="icon": אייקון שקט (אפור, אדום בריחוף ובמיקוד) לרשימות; השם הנגיש
 * זהה, כך שהאישור והבדיקות לא משתנים.
 */
export default function ForumDeleteButton({
  target,
  redirectTo,
  size = "sm",
  variant = "labelled",
}: {
  target: DeleteTarget;
  redirectTo?: string;
  size?: "sm" | "default";
  variant?: "labelled" | "icon";
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const isIcon = variant === "icon";
  const isPost = target.kind === "post";
  const noun = isPost ? "פוסט" : "תגובה";
  const url = isPost
    ? `/api/v1/forum/posts/${target.id}`
    : `/api/v1/forum/replies/${target.id}`;

  async function confirmDelete(): Promise<boolean> {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || `מחיקת ה${noun} נכשלה, נסו שוב`);
      return false;
    }
    toast.success(isPost ? "הפוסט נמחק" : "התגובה נמחקה");
    return true;
  }

  // רץ אחרי שהדיאלוג נסגר
  function handleDeleted() {
    if (redirectTo) router.replace(redirectTo as never);
    else router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={isIcon ? "icon-sm" : size}
        onClick={() => setIsOpen(true)}
        aria-label={`מחיקת ה${noun}`}
        title={isIcon ? `מחיקת ה${noun}` : undefined}
        className={
          isIcon
            ? "text-muted-foreground hover:text-destructive focus-visible:text-destructive"
            : "text-destructive hover:text-destructive"
        }
      >
        <Trash2 className="size-4" aria-hidden />
        {!isIcon && <span>מחיקה</span>}
      </Button>
      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={isPost ? "מחיקת פוסט" : "מחיקת תגובה"}
        description={describeRemoval(target)}
        confirmLabel={`מחיקת ה${noun}`}
        pendingLabel="מוחק..."
        onConfirm={confirmDelete}
        onSuccess={handleDeleted}
        onError={() => toast.error(`מחיקת ה${noun} נכשלה, נסו שוב`)}
      />
    </>
  );
}
