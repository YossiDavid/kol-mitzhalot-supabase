"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import SendProposalModal from "./send-proposal-modal";

/**
 * טיוטה נשמרת ב-shidduchim ולא נשלחה. מה שניתן לערוך בה הוא ההערות
 * לכל צד והיקף השליחה — בדיוק מה ש-SendProposalModal כבר עושה,
 * ולכן הוא מגויס כאן במקום מסך עריכה נפרד.
 */
export default function DraftActions({
  groomId,
  brideId,
  noteForGroom,
  noteForBride,
}: {
  groomId: string;
  brideId: string;
  noteForGroom: string | null;
  noteForBride: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async ({
    recipientScope,
    noteForGroom: groomNote,
    noteForBride: brideNote,
  }: {
    recipientScope: "both" | "groom_only" | "bride_only";
    noteForGroom: string;
    noteForBride: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/shidduchim/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groomId,
          brideId,
          action: "send",
          recipientScope,
          noteForGroom: groomNote,
          noteForBride: brideNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שגיאה בשליחת ההצעה");
        return;
      }
      toast.success("ההצעה נשלחה");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשליחת ההצעה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="size-4" />
        עריכה ושליחה
      </Button>

      <SendProposalModal
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleSend}
        loading={loading}
        initialNoteGroom={noteForGroom ?? ""}
        initialNoteBride={noteForBride ?? ""}
      />
    </>
  );
}
