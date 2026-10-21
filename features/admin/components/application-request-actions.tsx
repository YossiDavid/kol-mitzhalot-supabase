"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  APPLICATION_MESSAGE_MAX_LENGTH,
  APPLICATION_REJECT_REASON_MAX_LENGTH,
} from "@/features/admin/lib/application-decision-body";

import { ApplicationTextDialog } from "./application-text-dialog";

export type ApplicationRequestKind = "shadchanim" | "staff";

type DialogName = "approve" | "reject" | "message" | null;

const FALLBACK_ERROR = "הפעולה נכשלה, נסו שוב";

type ApplicationRequestActionsProps = {
  kind: ApplicationRequestKind;
  /** מזהה המשתמש המבקש (user_id של הבקשה) */
  requestId: string;
  /** כפתורי אישור/דחייה רק לבקשה ממתינה; "שליחת הודעה" תמיד */
  isPending: boolean;
};

/** שולח JSON ל-route של מנהל; מחזיר הודעת שגיאה בעברית או null בהצלחה */
export async function postAdminAction(
  url: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const data: unknown = await response.json().catch(() => null);
    const apiError =
      data && typeof data === "object" && "error" in data
        ? (data as { error: unknown }).error
        : null;
    // הודעות ה-API בעברית (400/404/429/500); קודי Unauthorized/Forbidden באנגלית
    return typeof apiError === "string" && /[א-ת]/.test(apiError)
      ? apiError
      : FALLBACK_ERROR;
  } catch (error) {
    console.error("Error in admin application action:", error);
    return FALLBACK_ERROR;
  }
}

/**
 * פעולות מנהל על בקשת הצטרפות (שדכן / איש צוות): אישור עם הודעה אופציונלית,
 * דחייה עם סיבה חובה, ושליחת הודעה למבקש/ת בכל סטטוס. הכול בדיאלוגים.
 */
export function ApplicationRequestActions({
  kind,
  requestId,
  isPending,
}: ApplicationRequestActionsProps) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<DialogName>(null);
  const base = `/api/v1/admin/${kind}`;

  async function run(
    endpoint: string,
    body: Record<string, unknown>,
    successText: string,
  ): Promise<string | null> {
    const failure = await postAdminAction(`${base}/${endpoint}`, body);
    if (failure) return failure;
    toast.success(successText);
    router.refresh();
    return null;
  }

  const close = (next: boolean) => {
    if (!next) setOpenDialog(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {isPending && (
        <>
          <Button onClick={() => setOpenDialog("approve")}>אשר</Button>
          <Button variant="destructive" onClick={() => setOpenDialog("reject")}>
            דחה
          </Button>
        </>
      )}
      <Button variant="outline" onClick={() => setOpenDialog("message")}>
        שליחת הודעה למבקש/ת
      </Button>

      {openDialog === "approve" && (
        <ApplicationTextDialog
          open
          onOpenChange={close}
          title="אישור הבקשה"
          description="האם לאשר את הבקשה? אפשר לצרף הודעה למבקש/ת (אופציונלי); היא תישלח בהתראה ובמייל האישור."
          fieldLabel="הודעה למבקש/ת (אופציונלי)"
          submitLabel="אשר בקשה"
          pendingLabel="מאשר..."
          maxLength={APPLICATION_MESSAGE_MAX_LENGTH}
          isRequired={false}
          onSubmit={(text) =>
            run(
              "approve",
              { userId: requestId, ...(text ? { message: text } : {}) },
              "הבקשה אושרה בהצלחה",
            )
          }
        />
      )}
      {openDialog === "reject" && (
        <ApplicationTextDialog
          open
          onOpenChange={close}
          title="דחיית הבקשה"
          description="הסיבה תישמר בבקשה ותישלח למבקש/ת בהתראה ובמייל."
          fieldLabel="סיבת הדחייה"
          submitLabel="דחה בקשה"
          pendingLabel="דוחה..."
          maxLength={APPLICATION_REJECT_REASON_MAX_LENGTH}
          isRequired
          isDestructive
          onSubmit={(text) =>
            run("reject", { userId: requestId, reason: text }, "הבקשה נדחתה")
          }
        />
      )}
      {openDialog === "message" && (
        <ApplicationTextDialog
          open
          onOpenChange={close}
          title="שליחת הודעה למבקש/ת"
          description="ההודעה תישלח למבקש/ת כהתראה באפליקציה וגם במייל."
          fieldLabel="תוכן ההודעה"
          submitLabel="שלח הודעה"
          pendingLabel="שולח..."
          maxLength={APPLICATION_MESSAGE_MAX_LENGTH}
          isRequired
          onSubmit={(text) =>
            run("message", { userId: requestId, message: text }, "ההודעה נשלחה")
          }
        />
      )}
    </div>
  );
}
