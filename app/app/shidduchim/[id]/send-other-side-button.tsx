"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RecipientScope = "both" | "groom_only" | "bride_only" | null;

export default function SendOtherSideButton({
  shidduchId,
  recipientScope,
  canEdit,
}: {
  shidduchId: string;
  recipientScope: RecipientScope;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!canEdit) return null;
  if (recipientScope !== "groom_only" && recipientScope !== "bride_only") {
    return null;
  }

  const targetLabel =
    recipientScope === "groom_only" ? "לצד המיועדת" : "לצד המיועד";
  const noteLabel =
    recipientScope === "groom_only" ? "הערה לצד המיועדת" : "הערה לצד המיועד";

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/shidduchim/send-other-side", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shidduchId, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שליחה נכשלה");
        return;
      }

      toast.success(
        Array.isArray(data.sentTo) && data.sentTo.length > 0
          ? `נשלח בהצלחה ל: ${data.sentTo.join(", ")}`
          : "נשלח בהצלחה לצד השני",
      );
      setOpen(false);
      setNote("");
      router.refresh();
    } catch {
      toast.error("שליחה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        <Button onClick={() => setOpen(true)} disabled={loading} variant="outline">
          {loading ? "שולח..." : `שליחה גם ${targetLabel}`}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{`שליחה גם ${targetLabel}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="send-other-side-note">{noteLabel}</Label>
            <Textarea
              id="send-other-side-note"
              placeholder="רוצה להוסיף הערה?"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="button" onClick={handleSend} disabled={loading}>
              {loading ? "שולח..." : "שלח"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
