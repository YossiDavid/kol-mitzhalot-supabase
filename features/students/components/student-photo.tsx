"use client";

import { useState } from "react";
import { Lock, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoRequestDialog } from "@/features/photo-requests/components/photo-request-dialog";

/**
 * שני מצבים בלבד, ולכן טיפוס מאוחד (discriminated union) על locked ולא שדות
 * אופציונליים: כך אי אפשר להעביר בטעות מצב נעול בלי studentId (ואז הדיאלוג
 * לא היה יודע איזו בקשה להגיש), ואי אפשר להעביר מצב פתוח בלי src.
 */
type StudentPhotoProps =
  | { locked?: false; src: string; alt: string }
  | { locked: true; alt: string; studentId: string };

/**
 * תמונת פרופיל עגולה.
 *
 * במצב הרגיל — לחיצה פותחת lightbox עם התמונה בגדול.
 * במצב הנעול (locked) — אין src כלל, כי השרת לא שולח ללקוח image_url של
 * מיועדת (ראה buildPublicStudent ו-photoPrivate ב-
 * app/app/students/[id]/page.tsx); מוצג מנעול, ולחיצה פותחת דיאלוג בקשת
 * הרשאת צפייה שמנהל מכריע בה.
 */
export default function StudentPhoto(props: StudentPhotoProps) {
  if (props.locked) {
    return <LockedPhoto alt={props.alt} studentId={props.studentId} />;
  }
  return <PhotoLightbox src={props.src} alt={props.alt} />;
}

function LockedPhoto({ alt, studentId }: { alt: string; studentId: string }) {
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

function PhotoLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="הגדלת התמונה"
        className="cursor-zoom-in rounded-full transition hover:ring-2 hover:ring-primary/40 hover:brightness-95"
      >
        <img
          src={src}
          alt={alt}
          className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
        />
      </button>
      <DialogContent
        dir="rtl"
        showCloseButton={false}
        // התיבה נצמדת לרוחב התמונה (w-auto) ולא נפרשת על 90vw. אחרת השטח
        // הריק שסביב התמונה עדיין נחשב "בתוך" הדיאלוג, ולחיצה בו לא סוגרת.
        className="w-auto max-w-[95vw] gap-0 border-none bg-transparent p-0 shadow-none sm:max-w-[95vw]"
        // גיבוי: לחיצה על שולי התיבה עצמה (ולא על התמונה) סוגרת גם היא
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          תצוגה מוגדלת של התמונה
        </DialogDescription>
        {/* כפתור הסגירה המובנה כהה ונבלע ברקע השחור — כאן לבן על רקע מוכהה */}
        <DialogClose
          aria-label="סגירה"
          className="absolute end-2 top-2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/70 focus:ring-2 focus:ring-white focus:outline-hidden"
        >
          <X className="h-5 w-5" />
        </DialogClose>
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[95vw] rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
