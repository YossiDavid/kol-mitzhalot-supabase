"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ellipsis,
  FileText,
  MessageSquare,
  Pencil,
  Share2,
  Trash2,
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
import { StudentDeleteDialog } from "@/features/students/components/delete-student-button";
import { StudentMessageDialog } from "@/features/students/components/message-button";
import { shareStudentCard } from "@/features/students/lib/share-student-card";

import { StudentStatusMenu, type PersonalStatus } from "./student-status-menu";

type OpenDialog = "message" | "delete" | null;

/**
 * שורת הפעולות של הכרטיס: פעולה ראשית אחת ("עריכה") ותפריט "עוד פעולות".
 * כל השאר יושב בתפריט, כדי שההדר לא יתמלא בכפתורים.
 *
 * ההרשאות מגיעות מהשרת ואינן נקבעות כאן: `canEdit` (בעלים/שדכן/מנהל),
 * `canManage` (שדכן/מנהל - פנייה ועדכון סטטוס), `canDelete` (מנהל בלבד).
 * השיתוף פתוח לכל מי שרואה את הכרטיס, וקובץ קו״ח מוצג רק כשקיים.
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
          {cvUrl && (
            <DropdownMenuItem asChild>
              <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                <FileText />
                קובץ קו״ח
              </a>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            disabled={!isInShidduchim}
            onSelect={() => {
              void handleShare();
            }}
          >
            <Share2 />
            שיתוף הכרטיס
          </DropdownMenuItem>

          {canMessage && (
            <DropdownMenuItem
              disabled={!isInShidduchim}
              onSelect={() => setOpenDialog("message")}
            >
              <MessageSquare />
              פניה למנהל הכרטיס
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

      {canMessage && authorId && (
        <StudentMessageDialog
          authorId={authorId}
          open={openDialog === "message"}
          onOpenChange={(open) => setOpenDialog(open ? "message" : null)}
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
