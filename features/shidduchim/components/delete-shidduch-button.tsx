"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/shidduchim/${shidduchId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "מחיקת ההצעה נכשלה");
        return;
      }
      toast.success("ההצעה נמחקה");
      setOpen(false);
      router.push(redirectTo as never);
    } catch {
      toast.error("מחיקת ההצעה נכשלה");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          <Trash2 className="h-4 w-4" />
          מחיקת ההצעה
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>מחיקת הצעת שידוך</DialogTitle>
          <DialogDescription>
            ההצעה <strong>{pairLabel}</strong> תימחק לצמיתות, יחד עם תגובות
            הצדדים שכבר התקבלו.
            {wasSent
              ? " ההצעה כבר נשלחה, ולכן היא תיעלם גם מהחשבון של מנהלי הכרטיסים שקיבלו אותה. המייל שכבר נשלח אליהם יישאר אצלם."
              : " לאחר המחיקה אפשר יהיה להציע את הצמד הזה מחדש."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            ביטול
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "מוחק..." : "מחיקת ההצעה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
