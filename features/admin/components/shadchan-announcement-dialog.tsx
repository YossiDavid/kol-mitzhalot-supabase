"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  formatAnnouncementResult,
  SHADCHAN_FEE_NOTICE,
  type AnnouncementResult,
} from "@/features/admin/lib/shadchan-announcement";

const ANNOUNCE_URL = "/api/v1/admin/shadchanim/announce";
const FALLBACK_ERROR = "שליחת ההודעה נכשלה, נסו שוב";
const BODY_ROWS = 7;

type Step = "closed" | "edit" | "confirm";

type Draft = { title: string; body: string };

const DEFAULT_DRAFT: Draft = {
  title: SHADCHAN_FEE_NOTICE.title,
  body: SHADCHAN_FEE_NOTICE.body,
};

/** שולח את ההודעה; מחזיר את התוצאה, או הודעת שגיאה בעברית */
async function postAnnouncement(
  draft: Draft,
): Promise<
  { ok: true; result: AnnouncementResult } | { ok: false; error: string }
> {
  const response = await fetch(ANNOUNCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: draft.title.trim(),
      body: draft.body.trim(),
    }),
  });
  const data: unknown = await response.json().catch(() => null);
  const record = (data ?? {}) as Record<string, unknown>;
  if (!response.ok) {
    const apiError = record.error;
    return {
      ok: false,
      error:
        typeof apiError === "string" && /[א-ת]/.test(apiError)
          ? apiError
          : FALLBACK_ERROR,
    };
  }
  return {
    ok: true,
    result: {
      recipients: Number(record.recipients) || 0,
      emailsSent: Number(record.emailsSent) || 0,
      emailsFailed: Number(record.emailsFailed) || 0,
      emailsSkipped: Number(record.emailsSkipped) || 0,
    },
  };
}

/**
 * "שליחת הודעה לכל השדכנים" ברשימת השדכנים של המנהל: דיאלוג עריכה (ממולא
 * מראש בהודעת ההפרשה למערכת), ואחריו דיאלוג אישור לפני השליחה.
 */
export function ShadchanAnnouncementButton() {
  const [step, setStep] = useState<Step>("closed");
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);

  const isDraftValid =
    draft.title.trim().length > 0 && draft.body.trim().length > 0;

  function closeEditor(next: boolean) {
    if (!next) setStep("closed");
  }

  return (
    <>
      <Button type="button" onClick={() => setStep("edit")}>
        שליחת הודעה לכל השדכנים
      </Button>

      <Dialog open={step === "edit"} onOpenChange={closeEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שליחת הודעה לכל השדכנים</DialogTitle>
            <DialogDescription>
              ההודעה תישלח כהתראה במערכת וכמייל לכל השדכנים המאושרים שאינם
              מוקפאים.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shadchan-announcement-title">כותרת</Label>
              <Input
                id="shadchan-announcement-title"
                value={draft.title}
                maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shadchan-announcement-body">תוכן ההודעה</Label>
              <Textarea
                id="shadchan-announcement-body"
                value={draft.body}
                maxLength={ANNOUNCEMENT_BODY_MAX_LENGTH}
                rows={BODY_ROWS}
                onChange={(event) =>
                  setDraft({ ...draft, body: event.target.value })
                }
              />
              <p className="text-body-sm text-muted-foreground">
                {draft.body.length}/{ANNOUNCEMENT_BODY_MAX_LENGTH}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("closed")}
            >
              ביטול
            </Button>
            <Button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={!isDraftValid}
            >
              המשך לשליחה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={step === "confirm"}
        onOpenChange={(next) => {
          // ביטול באישור מחזיר לעריכה, בלי לאבד את הטקסט
          if (!next) setStep("edit");
        }}
        title="לשלוח את ההודעה לכל השדכנים?"
        description={`"${draft.title.trim()}" תישלח כהתראה וכמייל לכל השדכנים הפעילים. אי אפשר לבטל שליחה.`}
        confirmLabel="שליחה"
        pendingLabel="שולח..."
        isDestructive={false}
        onConfirm={async () => {
          const outcome = await postAnnouncement(draft);
          if (!outcome.ok) {
            toast.error(outcome.error);
            return false;
          }
          toast.success(formatAnnouncementResult(outcome.result));
          return true;
        }}
        onSuccess={() => {
          setStep("closed");
          setDraft(DEFAULT_DRAFT);
        }}
        onError={(error) => {
          console.error("[shadchan-announcement] send failed:", error);
          toast.error(FALLBACK_ERROR);
        }}
      />
    </>
  );
}
