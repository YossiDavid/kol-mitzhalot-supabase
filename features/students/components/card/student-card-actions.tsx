"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ellipsis,
  FileText,
  Flag,
  Pause,
  Pencil,
  Play,
  Share2,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardAdminPauseDialog } from "@/features/admin/components/card-admin-pause-dialog";
import { ReportCardDialog } from "@/features/students/components/card/report-card-dialog";
import { StudentDeleteDialog } from "@/features/students/components/delete-student-button";
import { StudentChatButton } from "@/features/students/components/message-button";
import { shareStudentCard } from "@/features/students/lib/share-student-card";

import { StudentStatusMenu, type PersonalStatus } from "./student-status-menu";

type OpenDialog = "delete" | "report" | "pause" | null;

/**
 * שורת הפעולות של הכרטיס: פעולה ראשית אחת ("עריכה"), כפתור "צ'אט" גלוי ותפריט
 * "עוד פעולות". כל השאר יושב בתפריט, כדי שההדר לא יתמלא בכפתורים.
 *
 * ההרשאות מגיעות מהשרת ואינן נקבעות כאן: `canEdit` (בעלים/שדכן/מנהל),
 * `canManage` (שדכן/מנהל - פנייה ועדכון סטטוס), `canDelete` (מנהל בלבד).
 * השיתוף פתוח לכל מי שרואה את הכרטיס. קובץ קו״ח הוא כפתור גלוי בהדר, ורק
 * כשקיים (בהצעת שידוך הוא נשלף רק כשהשדכן בחר לשתף את הקו״ח).
 */
export function StudentCardActions({
  studentId,
  studentName,
  authorId,
  cvUrl,
  personalStatus,
  gender,
  canEdit,
  canManage,
  canDelete,
  inShidduchim,
  ownerUserId,
  canReport = false,
  adminPause = null,
}: {
  studentId: string;
  studentName: string;
  /** בעל הכרטיס - נמען הפנייה */
  authorId: string | null;
  cvUrl: string | null;
  personalStatus: PersonalStatus | null;
  gender: "male" | "female" | null;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
  /** false - הכרטיס הוצא משידוכים. null/undefined בשורה ישנה נחשב פעיל */
  inShidduchim?: boolean | null;
  /** בעל הכרטיס, לקישור "פרטי המשתמש" - נמסר למנהל מערכת בלבד */
  ownerUserId?: string | null;
  /** מחובר, רואה את הכרטיס ואינו בעליו: "דיווח על הכרטיס". נקבע בשרת */
  canReport?: boolean;
  /** מנהל מערכת בלבד: מצב ההשהיה ע"י הנהלה. null - אין בקרת השהיה */
  adminPause?: { isPaused: boolean } | null;
}) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const handleShare = async () => {
    const result = await shareStudentCard(studentId, studentName);
    if (result === "copied") {
      toast.success("הקישור הועתק");
    }
  };

  // כרטיס שהוצא משידוכים: הפעולות שמפנות אליו החוצה חסומות. העריכה, עדכון
  // הסטטוס, קובץ קו״ח והמחיקה נשארות - בלעדיהן אין דרך להחזיר אותו לשידוכים
  const isInShidduchim = inShidduchim !== false;
  const canMessage = canManage && Boolean(authorId);

  return (
    <>
      {canEdit && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/students/${studentId}/edit`}>
            <Pencil className="h-4 w-4" />
            עריכה
          </Link>
        </Button>
      )}

      {canMessage && authorId && (
        <StudentChatButton
          authorId={authorId}
          studentId={studentId}
          isDisabled={!isInShidduchim}
        />
      )}

      {cvUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={cvUrl} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4" />
            קובץ קו״ח
          </a>
        </Button>
      )}

      {/* modal={false}: התפריט נסגר ברגע שנבחר פריט שפותח דיאלוג, ובלעדיו שתי
          שכבות הסגירה מתנגשות ונועלות את העכבר על העמוד */}
      <DropdownMenu dir="rtl" modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="עוד פעולות">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        {/* align="end": בממשק RTL הקצה הזה הוא שמאל, וכך התפריט נפתח פנימה
            אל תוך העמוד במקום להידחק אל שפת החלון */}
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem
            disabled={!isInShidduchim}
            onSelect={() => {
              void handleShare();
            }}
          >
            <Share2 />
            שיתוף הכרטיס
          </DropdownMenuItem>

          {ownerUserId && (
            <DropdownMenuItem asChild>
              <Link href={`/app/admin/users/${ownerUserId}`}>
                <UserRound />
                פרטי המשתמש
              </Link>
            </DropdownMenuItem>
          )}

          {canReport && (
            <DropdownMenuItem onSelect={() => setOpenDialog("report")}>
              <Flag />
              דיווח על הכרטיס
            </DropdownMenuItem>
          )}

          {adminPause && (
            <DropdownMenuItem onSelect={() => setOpenDialog("pause")}>
              {adminPause.isPaused ? <Play /> : <Pause />}
              {adminPause.isPaused ? "ביטול השהיה" : "השהיית הכרטיס"}
            </DropdownMenuItem>
          )}

          {canManage && (
            <StudentStatusMenu
              studentId={studentId}
              currentStatus={personalStatus}
              gender={gender}
            />
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setOpenDialog("delete")}
              >
                <Trash2 />
                מחיקת כרטיס
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canReport && (
        <ReportCardDialog
          studentId={studentId}
          studentName={studentName}
          open={openDialog === "report"}
          onOpenChange={(open) => setOpenDialog(open ? "report" : null)}
        />
      )}

      {adminPause && (
        <CardAdminPauseDialog
          studentId={studentId}
          studentName={studentName}
          isPaused={adminPause.isPaused}
          open={openDialog === "pause"}
          onOpenChange={(open) => setOpenDialog(open ? "pause" : null)}
        />
      )}

      {canDelete && (
        <StudentDeleteDialog
          studentId={studentId}
          studentName={studentName}
          redirectTo="/app/students"
          open={openDialog === "delete"}
          onOpenChange={(open) => setOpenDialog(open ? "delete" : null)}
        />
      )}
    </>
  );
}
