"use client";

import { useEffect, useState } from "react";

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
import { cn } from "@/lib/utils";

export type RecipientScope = "both" | "groom_only" | "bride_only";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (p: {
    recipientScope: RecipientScope;
    noteForGroom: string;
    noteForBride: string;
  }) => Promise<void>;
  loading?: boolean;
};

const TAB_ITEMS: { scope: RecipientScope; label: string }[] = [
  { scope: "both", label: "לשני הצדדים" },
  { scope: "groom_only", label: "רק לצד המיועד" },
  { scope: "bride_only", label: "רק לצד המיועדת" },
];

export default function SendProposalModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: Props) {
  const [scope, setScope] = useState<RecipientScope>("both");
  const [noteGroom, setNoteGroom] = useState("");
  const [noteBride, setNoteBride] = useState("");

  useEffect(() => {
    if (!open) {
      setScope("both");
      setNoteGroom("");
      setNoteBride("");
    }
  }, [open]);

  const showGroomNote = scope === "both" || scope === "groom_only";
  const showBrideNote = scope === "both" || scope === "bride_only";

  const handleSubmit = async () => {
    await onConfirm({
      recipientScope: scope,
      noteForGroom: showGroomNote ? noteGroom : "",
      noteForBride: showBrideNote ? noteBride : "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle>שליחת הצעת שידוך</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-3">
            <p className="text-sm font-medium">למי לשלוח את ההצעה?</p>
            <div
              role="tablist"
              aria-label="בחירת נמעני ההצעה"
              className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1"
            >
              {TAB_ITEMS.map(({ scope: tabScope, label }) => (
                <button
                  key={tabScope}
                  type="button"
                  role="tab"
                  aria-selected={scope === tabScope}
                  disabled={loading}
                  onClick={() => setScope(tabScope)}
                  className={cn(
                    "min-h-9 flex-1 rounded-md px-2 py-1.5 text-center text-sm font-medium transition-colors",
                    scope === tabScope
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">
              רוצה להוסיף כמה מילים על השידוך?
            </p>

            {showGroomNote && (
              <div className="space-y-2">
                <Label htmlFor="note-groom">הערה לצד המיועד</Label>
                <Textarea
                  id="note-groom"
                  placeholder="טקסט חופשי…"
                  value={noteGroom}
                  onChange={(e) => setNoteGroom(e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>
            )}

            {showBrideNote && (
              <div className="space-y-2">
                <Label htmlFor="note-bride">הערה לצד המיועדת</Label>
                <Textarea
                  id="note-bride"
                  placeholder="טקסט חופשי…"
                  value={noteBride}
                  onChange={(e) => setNoteBride(e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={loading}
          >
            ביטול
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "שולח…" : "שלח הצעה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
