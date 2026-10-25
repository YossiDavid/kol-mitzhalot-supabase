"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SHADCHAN_MODERATION_REASON_MAX_LENGTH } from "@/features/admin/lib/shadchan-moderation";

import { postAdminAction } from "./application-request-actions";
import { ApplicationTextDialog } from "./application-text-dialog";

const BASE_URL = "/api/v1/admin/shadchanim";

type DialogName = "freeze" | "unfreeze" | "revoke" | "restore" | null;

type ShadchanModerationActionsProps = {
  userId: string;
  name: string;
  isFrozen: boolean;
  /** יש שורת פרופיל - בלעדיה אין מה להקפיא */
  canFreeze: boolean;
  /** יש תפקיד שדכן להסרה */
  canRevoke: boolean;
  /** יש פרופיל שדכן בלי תפקיד (הוסר או נדחה) - אפשר להחזיר הרשאות */
  canRestore?: boolean;
};

/**
 * פעולות מנהל ברשימת השדכנים: הקפאה / ביטול הקפאה (הפיך) והסרת הרשאות.
 * כל פעולה בדיאלוג אישור; ההרשאה נאכפת בנתיבי ה-API.
 */
export function ShadchanModerationActions({
  userId,
  name,
  isFrozen,
  canFreeze,
  canRevoke,
  canRestore = false,
}: ShadchanModerationActionsProps) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<DialogName>(null);

  async function run(
    endpoint: "freeze" | "revoke",
    body: Record<string, unknown>,
    successText: string,
  ): Promise<string | null> {
    const failure = await postAdminAction(`${BASE_URL}/${endpoint}`, body);
    if (failure) return failure;
    toast.success(successText);
    router.refresh();
    return null;
  }

  const close = (next: boolean) => {
    if (!next) setOpenDialog(null);
  };

  return (
    <>
      {canFreeze && (canRevoke || isFrozen) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenDialog(isFrozen ? "unfreeze" : "freeze")}
          aria-label={`${isFrozen ? "ביטול הקפאה" : "הקפאה"}: ${name}`}
        >
          {isFrozen ? "ביטול הקפאה" : "הקפאה"}
        </Button>
      )}
      {canRevoke && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setOpenDialog("revoke")}
          aria-label={`הסרת הרשאות: ${name}`}
        >
          הסרת הרשאות
        </Button>
      )}

      {canRestore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenDialog("restore")}
          aria-label={`החזרת הרשאות: ${name}`}
        >
          החזרת הרשאות
        </Button>
      )}

      {openDialog === "restore" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`החזרת הרשאות השדכן של ${name}`}
          description="תפקיד השדכן יוחזר והבקשה תסומן כמאושרת. השדכן יקבל מייל והתראה על האישור."
          confirmLabel="החזר הרשאות"
          pendingLabel="מחזיר..."
          isDestructive={false}
          onConfirm={async () => {
            // אותו נתיב כמו אישור בקשה: מוסיף את התפקיד בלי לדרוס תפקידים אחרים
            const failure = await postAdminAction(`${BASE_URL}/approve`, {
              userId,
            });
            if (failure) {
              toast.error(failure);
              return false;
            }
            toast.success("הרשאות השדכן הוחזרו");
            return true;
          }}
          onSuccess={() => router.refresh()}
          onError={(error) => {
            console.error("[shadchan-moderation] restore failed:", error);
            toast.error("החזרת ההרשאות נכשלה");
          }}
        />
      )}

      {openDialog === "freeze" && (
        <ApplicationTextDialog
          open
          onOpenChange={close}
          title={`הקפאת ${name}`}
          description="השדכן לא יוכל לגשת לאזורי השדכנים (רשימת המיועדים, לוח ההתאמות, הפורום) ולא יופיע ברשימת השדכנים עד לביטול ההקפאה. התפקיד והנתונים נשמרים."
          fieldLabel="סיבת ההקפאה (אופציונלי, תישלח לשדכן בהתראה)"
          submitLabel="הקפא"
          pendingLabel="מקפיא..."
          maxLength={SHADCHAN_MODERATION_REASON_MAX_LENGTH}
          isRequired={false}
          isDestructive
          onSubmit={(text) =>
            run(
              "freeze",
              { userId, frozen: true, ...(text ? { reason: text } : {}) },
              "השדכן הוקפא",
            )
          }
        />
      )}
      {openDialog === "unfreeze" && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`ביטול הקפאת ${name}`}
          description="הרשאות השדכן יחזרו לפעול מיד, והשדכן יקבל על כך התראה."
          confirmLabel="ביטול הקפאה"
          pendingLabel="מעדכן..."
          isDestructive={false}
          onConfirm={async () => {
            const failure = await postAdminAction(`${BASE_URL}/freeze`, {
              userId,
              frozen: false,
            });
            if (failure) {
              toast.error(failure);
              return false;
            }
            toast.success("ההקפאה בוטלה");
            return true;
          }}
          onSuccess={() => router.refresh()}
          onError={(error) => {
            console.error("[shadchan-moderation] unfreeze failed:", error);
            toast.error("ביטול ההקפאה נכשל");
          }}
        />
      )}
      {openDialog === "revoke" && (
        <ApplicationTextDialog
          open
          onOpenChange={close}
          title={`הסרת הרשאות השדכן של ${name}`}
          description="תפקיד השדכן יוסר והבקשה תסומן כנדחתה. הפרופיל וההצעות הקיימות נשמרים, והמשתמש יוכל להגיש בקשה חדשה. הסיבה תישלח לשדכן בהתראה."
          fieldLabel="סיבת הסרת ההרשאות"
          submitLabel="הסר הרשאות"
          pendingLabel="מסיר..."
          maxLength={SHADCHAN_MODERATION_REASON_MAX_LENGTH}
          isRequired
          isDestructive
          onSubmit={(text) =>
            run("revoke", { userId, reason: text }, "הרשאות השדכן הוסרו")
          }
        />
      )}
    </>
  );
}
