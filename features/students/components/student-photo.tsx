"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudentPhotoProps {
  src: string;
  alt: string;
}

/** תמונת פרופיל עגולה — לחיצה פותחת lightbox עם התמונה בגדול. */
export default function StudentPhoto({ src, alt }: StudentPhotoProps) {
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
