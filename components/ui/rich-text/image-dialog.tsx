"use client";

import type { Editor } from "@tiptap/react";
import { useState } from "react";

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
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_MB,
  uploadContentImage,
  validateContentImage,
} from "@/lib/storage/content-images";

/** תיקייה ב-bucket `content` לתמונות שמוכנסות לגוף מאמר */
const ARTICLE_IMAGES_FOLDER = "articles";

interface ImageDialogProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** חלון העלאת תמונה מפקודת "/". טקסט חלופי (alt) חובה, לנגישות */
export function ImageDialog({ editor, open, onOpenChange }: ImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <ImageDialogBody editor={editor} onDone={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function ImageDialogBody({
  editor,
  onDone,
}: {
  editor: Editor;
  onDone: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function apply() {
    if (!file) {
      setError("יש לבחור קובץ תמונה.");
      return;
    }
    if (!alt.trim()) {
      setError("יש להזין תיאור לתמונה (טקסט חלופי), לנגישות ולמנועי חיפוש.");
      return;
    }

    setIsUploading(true);
    try {
      const src = await uploadContentImage(
        createClient(),
        file,
        ARTICLE_IMAGES_FOLDER,
      );
      editor
        .chain()
        .focus()
        .insertContent({ type: "image", attrs: { src, alt: alt.trim() } })
        .run();
      onDone(false);
    } catch (uploadError) {
      const reason =
        uploadError instanceof Error ? uploadError.message : "שגיאה לא ידועה";
      setError(`העלאה נכשלה: ${reason}`);
      setIsUploading(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>הוספת תמונה</DialogTitle>
        <DialogDescription>
          JPG, PNG, WEBP או GIF, עד {MAX_IMAGE_MB}MB.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="image-dialog-file">קובץ תמונה</Label>
          <Input
            id="image-dialog-file"
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            disabled={isUploading}
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              const validation = selected
                ? validateContentImage(selected)
                : null;
              setFile(validation ? null : selected);
              setError(validation);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="image-dialog-alt">תיאור התמונה (חובה)</Label>
          <Input
            id="image-dialog-alt"
            value={alt}
            disabled={isUploading}
            onChange={(event) => {
              setAlt(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void apply();
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? "image-dialog-error" : undefined}
          />
        </div>
        {error && (
          <p
            id="image-dialog-error"
            role="alert"
            className="text-body-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDone(false)}
          disabled={isUploading}
        >
          ביטול
        </Button>
        <Button
          type="button"
          onClick={() => void apply()}
          disabled={isUploading}
        >
          {isUploading ? "מעלה..." : "הוספה"}
        </Button>
      </DialogFooter>
    </>
  );
}
