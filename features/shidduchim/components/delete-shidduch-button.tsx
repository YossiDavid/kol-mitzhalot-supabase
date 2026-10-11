"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function DeleteShidduchButton({
  shidduchId,
  pairLabel,
  wasSent,
  redirectTo = "/app/shadchan/proposals",
  variant = "destructive",
}: {
  /** ברשימה ליד פעולה ראשית עדיף מתאר, כדי שהמחיקה לא תבלוט מעליה */
  variant?: "destructive" | "destructiveOutline";
  shidduchId: string;
  /** "מיועד - מיועדת", לזיהוי ההצעה בדיאלוג */
  pairLabel: string;
  /** נשלחה כבר לצדדים — אז המחיקה נוגעת גם בהם */
  wasSent: boolean;
  /** יעד ניווט אחרי המחיקה: הדף הנוכחי כבר לא יהיה נגיש */
  redirectTo?: string;
}) {
  const router = useRouter();

  async function handleDelete(): Promise<boolean> {
    const res = await fetch(`/api/v1/shidduchim/${shidduchId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "מחיקת ההצעה נכשלה");
      return false;
    }
    toast.success("ההצעה נמחקה");
    return true;
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant={variant} size="sm">
          <Trash2 className="h-4 w-4" />
          מחיקת ההצעה
        </Button>
      }
      title="מחיקת הצעת שידוך"
      description={
        <>
          ההצעה <strong>{pairLabel}</strong> תימחק לצמיתות, יחד עם תגובות הצדדים
          שכבר התקבלו.
          {wasSent
            ? " ההצעה כבר נשלחה, ולכן היא תיעלם גם מהחשבון של מנהלי הכרטיסים שקיבלו אותה. המייל שכבר נשלח אליהם יישאר אצלם."
            : " לאחר המחיקה אפשר יהיה להציע את הצמד הזה מחדש."}
        </>
      }
      confirmLabel="מחיקת ההצעה"
      pendingLabel="מוחק..."
      onConfirm={handleDelete}
      onSuccess={() => router.push(redirectTo as never)}
      onError={() => toast.error("מחיקת ההצעה נכשלה")}
    />
  );
}
