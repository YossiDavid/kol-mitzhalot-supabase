"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CLOSED_NOTICE_MAX_LENGTH,
  CLOSED_NOTICE_PRESETS,
} from "@/features/shidduchim/lib/closed-notice";
import {
  SHIDDUCH_SIDE_LABELS,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";

type InformOtherSideButtonProps = {
  shidduchId: string;
  /** הצדדים שההצעה נשלחה אליהם - רק אליהם אפשר לעדכן */
  recipientSides: readonly ShidduchSide[];
  /** ברירת המחדל (הצד שלא דחה); null = השדכן בוחר במפורש */
  defaultSide: ShidduchSide | null;
};

/**
 * "עדכון הצד השני": השדכן מודיע לצד שלא דחה שההצעה ירדה מהפרק. לא אוטומטי -
 * הוא בוחר ניסוח מוכן או כותב משלו. הניסוחים המוכנים ניטרליים; הניסוח
 * החופשי באחריות השדכן. אכיפת ההרשאות והנמענות בשרת.
 */
export default function InformOtherSideButton({
  shidduchId,
  recipientSides,
  defaultSide,
}: InformOtherSideButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [side, setSide] = useState<ShidduchSide | null>(defaultSide);
  const [message, setMessage] = useState("");

  const trimmed = message.trim();
  const canSend =
    !isSending &&
    side !== null &&
    trimmed.length > 0 &&
    trimmed.length <= CLOSED_NOTICE_MAX_LENGTH;

  const handleOpenChange = (next: boolean) => {
    if (isSending) return;
    setOpen(next);
    if (next) {
      setSide(defaultSide);
      setMessage("");
    }
  };

  const handleSend = async () => {
    if (!canSend || side === null) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/v1/shidduchim/closed-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shidduchId, side, message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "שליחת העדכון נכשלה");
        return;
      }

      toast.success(
        data.emailSent
          ? "הצד השני עודכן בהתראה ובמייל"
          : "הצד השני עודכן בהתראה במערכת",
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("שליחת העדכון נכשלה");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div>
        <Button variant="outline" onClick={() => handleOpenChange(true)}>
          עדכון הצד השני
        </Button>
      </div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עדכון הצד השני</DialogTitle>
            <DialogDescription>
              ההודעה תישלח כהתראה במערכת ובמייל למנהל הכרטיס של הצד שנבחר.
              ההודעה לא תכלול מי דחה ומדוע, אלא רק את מה שתבחרו או תכתבו כאן.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2" disabled={isSending}>
            <legend className="text-body-sm font-medium">למי לשלוח</legend>
            <div className="flex flex-wrap gap-4">
              {recipientSides.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-body-sm"
                >
                  <input
                    type="radio"
                    name="closed-notice-side"
                    value={option}
                    checked={side === option}
                    onChange={() => setSide(option)}
                  />
                  {SHIDDUCH_SIDE_LABELS[option]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <p className="text-body-sm font-medium">ניסוחים מוכנים</p>
            <div className="flex flex-wrap gap-2">
              {CLOSED_NOTICE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={message === preset.text ? "default" : "outline"}
                  onClick={() => setMessage(preset.text)}
                  disabled={isSending}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closed-notice-message">ההודעה</Label>
            <Textarea
              id="closed-notice-message"
              rows={4}
              maxLength={CLOSED_NOTICE_MAX_LENGTH}
              placeholder="בחרו ניסוח מוכן או כתבו הודעה משלכם"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
            />
            <p className="text-caption text-muted-foreground">
              {message.length}/{CLOSED_NOTICE_MAX_LENGTH}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSending}
            >
              ביטול
            </Button>
            <Button type="button" onClick={handleSend} disabled={!canSend}>
              {isSending ? "שולח..." : "שלח"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
