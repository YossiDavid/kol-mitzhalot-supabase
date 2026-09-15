"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Lock, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { compressStudentPhoto } from "@/features/students/lib/compress-student-photo";
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_STUDENT_PHOTOS,
  validatePhotoFile,
  type StudentPhotoItem,
} from "@/features/students/lib/student-photo-rules";

// גלריית התמונות שבטופס הקו״ח. הסדר ברשימה הוא סדר התצוגה, והראשונה היא
// התמונה הראשית. הרכיב מנהל את הרשימה ומקטין כל תמונה כבר בהוספה - ההעלאה
// והשמירה נעשות בשליחה (saveStudentPhotos), כדי שביטול הטופס לא ישאיר קבצים
// יתומים באחסון.

type PhotoGalleryFieldProps = {
  id?: string;
  value: readonly StudentPhotoItem[] | undefined;
  onChange: (items: StudentPhotoItem[]) => void;
};

const ACCEPT_ATTRIBUTE = ACCEPTED_PHOTO_TYPES.join(",");

function itemKey(item: StudentPhotoItem): string {
  return item.kind === "existing" ? item.path : item.id;
}

function isLocked(item: StudentPhotoItem): boolean {
  return item.kind === "existing" && item.url === null;
}

export function PhotoGalleryField({
  id,
  value,
  onChange,
}: PhotoGalleryFieldProps) {
  const items = value ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // בזמן ההקטנה כל הפעולות נעולות: הרשימה מתעדכנת בסופה, ושינוי באמצע
  // היה נדרס
  const [isProcessing, setIsProcessing] = useState(false);
  const remaining = MAX_STUDENT_PHOTOS - items.length;

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // נקרא לפני ה-await הראשון: שדה הקובץ מתאפס מיד אחרי הקריאה
    const candidates = Array.from(files).filter((file) => {
      const error = validatePhotoFile(file);
      if (error) toast.error(error);
      return !error;
    });

    if (candidates.length > remaining) {
      toast.error(`ניתן לשמור עד ${MAX_STUDENT_PHOTOS} תמונות`);
    }
    const selected = candidates.slice(0, Math.max(0, remaining));
    if (selected.length === 0) return;

    setIsProcessing(true);
    try {
      const added: StudentPhotoItem[] = [];
      for (const file of selected) {
        try {
          const compressed = await compressStudentPhoto(file);
          added.push({
            kind: "new",
            id: crypto.randomUUID(),
            file: compressed,
          });
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : `לא הצלחנו לעבד את ${file.name}`,
          );
        }
      }
      if (added.length > 0) onChange([...items, ...added]);
    } finally {
      setIsProcessing(false);
    }
  };

  const remove = (key: string) =>
    onChange(items.filter((item) => itemKey(item) !== key));

  const makeMain = (key: string) => {
    const target = items.find((item) => itemKey(item) === key);
    if (!target) return;
    onChange([target, ...items.filter((item) => itemKey(item) !== key)]);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    void addFiles(event.dataTransfer.files);
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <li
          // תמונה נעולה מגיעה בלי נתיב, ולכן בלי מפתח משלה
          key={itemKey(item) || `locked-${index}`}
          className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
        >
          <PhotoTilePreview item={item} position={index + 1} />

          {index === 0 && (
            <span className="absolute start-2 top-2 rounded-md bg-primary px-2 py-0.5 text-caption text-primary-foreground">
              תמונה ראשית
            </span>
          )}

          {!isLocked(item) && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-background/85 p-1">
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="הגדרה כתמונה ראשית"
                  title="הגדרה כתמונה ראשית"
                  disabled={isProcessing}
                  onClick={() => makeMain(itemKey(item))}
                >
                  <Star />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="הסרה"
                title="הסרה"
                className="text-destructive hover:text-destructive"
                disabled={isProcessing}
                onClick={() => remove(itemKey(item))}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        </li>
      ))}

      {remaining > 0 && (
        <li className="aspect-square">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            aria-busy={isProcessing}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex size-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-2 text-center text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:hover:border-border disabled:hover:text-muted-foreground",
              isDragOver && "border-primary bg-primary-muted text-primary",
            )}
          >
            {isProcessing ? (
              <>
                <Spinner />
                <span className="text-body-sm">מקטין תמונות…</span>
              </>
            ) : (
              <>
                <ImagePlus className="size-6" aria-hidden />
                <span className="text-body-sm">הוספת תמונות</span>
                <span className="text-caption">
                  {items.length}/{MAX_STUDENT_PHOTOS}
                </span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            id={id}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            aria-label="בחירת תמונות"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void addFiles(event.target.files);
              // מאפשר לבחור שוב את אותו קובץ אחרי שהוסר
              event.target.value = "";
            }}
          />
        </li>
      )}
    </ul>
  );
}

function PhotoTilePreview({
  item,
  position,
}: {
  item: StudentPhotoItem;
  position: number;
}) {
  if (item.kind === "new") {
    return <NewPhotoPreview file={item.file} position={position} />;
  }

  if (item.url === null) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <Lock className="size-6" aria-hidden />
        <span className="text-caption">חסויה</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- קישור חתום קצר-מועד, לא דרך אופטימיזציית next/image
    <img
      src={item.url}
      alt={`תמונה ${position}`}
      className="size-full object-cover"
    />
  );
}

/**
 * כתובת ה-blob נוצרת ומשוחררת באותו effect, ישירות על האלמנט - כך היא
 * משתחררת בהסרת התמונה או ביציאה מהטופס, גם תחת StrictMode.
 */
function NewPhotoPreview({ file, position }: { file: File; position: number }) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה של blob מקומי
    <img
      ref={imageRef}
      alt={`תמונה חדשה ${position}`}
      className="size-full object-cover"
    />
  );
}
