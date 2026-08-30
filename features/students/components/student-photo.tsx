"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
        className="cursor-zoom-in rounded-full transition hover:brightness-95 hover:ring-2 hover:ring-primary/40"
      >
        <img
          src={src}
          alt={alt}
          className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
        />
      </button>
      <DialogContent
        dir="rtl"
        className="max-w-[90vw] gap-0 border-none bg-transparent p-0 shadow-none sm:max-w-[90vw]"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
