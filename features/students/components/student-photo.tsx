"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { PhotoRequestDialog } from "@/features/photo-requests/components/photo-request-dialog";

/**
 * תמונה נעולה: יש לכרטיס תמונות, אבל הצופה אינו רשאי לראות אותן (בת, בלי
 * אישור צפייה). השרת לא שולח קישור או נתיב כלל - ראה loadStudentPhotos.
 * לחיצה פותחת דיאלוג בקשת הרשאת צפייה שמנהל מכריע בה.
 * התצוגה הפתוחה היא StudentPhotoGallery.
 */
export default function LockedStudentPhoto({
  alt,
  studentId,
}: {
  alt: string;
  studentId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="בקשת הרשאה לצפייה בתמונה"
        title="בקשת הרשאה לצפייה בתמונה"
        className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-full border bg-muted transition hover:ring-2 hover:ring-primary/40 hover:brightness-95 sm:h-24 sm:w-24"
      >
        <Lock className="h-6 w-6 text-muted-foreground" />
        <span className="text-caption text-muted-foreground">חסוי</span>
      </button>
      <PhotoRequestDialog
        studentId={studentId}
        studentName={alt}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
