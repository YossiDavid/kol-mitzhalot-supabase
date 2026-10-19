"use client";

import { useId, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AVATAR_ACCEPT,
  buildAvatarPath,
  SHADCHAN_AVATARS_BUCKET,
  validateAvatarFile,
} from "@/features/shadchanim/lib/avatar";
import { createClient } from "@/lib/supabase/client";

interface ShadchanAvatarFieldProps {
  /** בעל הפרופיל: התמונה נשמרת בתיקייה שלו (גם כשמנהל מעלה) */
  ownerId: string;
  /** הנתיב השמור בטופס ("" = אין תמונה) */
  value: string;
  onChange: (path: string) => void;
  /** הקישור להצגה (חתום / מקומי אחרי העלאה) */
  previewUrl: string | null;
  onPreviewChange: (url: string | null) => void;
  disabled?: boolean;
}

const UPLOAD_ERROR_MESSAGE = "העלאת התמונה נכשלה, נסו שוב";

/**
 * העלאת תמונת השדכן ל-bucket הפרטי. הקובץ עולה מיד בבחירה, והטופס שומר רק
 * את הנתיב - כך השמירה עצמה לא תלויה בהעלאה. ה-RLS מתיר כתיבה רק לתיקייה
 * של המשתמש עצמו (או למנהל).
 */
export function ShadchanAvatarField({
  ownerId,
  value,
  onChange,
  previewUrl,
  onPreviewChange,
  disabled = false,
}: ShadchanAvatarFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const invalid = validateAvatarFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const path = buildAvatarPath(ownerId, file);
      const { error: uploadError } = await createClient()
        .storage.from(SHADCHAN_AVATARS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      onChange(path);
      onPreviewChange(URL.createObjectURL(file));
    } catch (uploadError: unknown) {
      console.error("Error uploading shadchan avatar:", uploadError);
      setError(UPLOAD_ERROR_MESSAGE);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange("");
    onPreviewChange(null);
  };

  const isBusy = disabled || isUploading;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-20">
        {previewUrl && <AvatarImage src={previewUrl} alt="תמונת הפרופיל" />}
        <AvatarFallback>
          <ImageUp className="size-6 text-muted-foreground" aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={AVATAR_ACCEPT}
          className="sr-only"
          data-testid="shadchan-avatar-input"
          disabled={isBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp aria-hidden />
          {isUploading ? "מעלה..." : value ? "החלפת תמונה" : "העלאת תמונה"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={handleRemove}
          >
            <Trash2 aria-hidden />
            הסרה
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="w-full text-body-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
