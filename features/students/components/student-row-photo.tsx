"use client";

import { useState } from "react";
import { ImageIcon, ImageOff, Lock } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { PhotoRequestDialog } from "@/features/photo-requests/components/photo-request-dialog";
import { PhotoLightbox } from "@/features/students/components/student-photo-gallery";
import {
  SIGNED_URL_CLIENT_LIFETIME_MS,
  studentGalleryEndpoint,
  type StudentGalleryResponse,
} from "@/features/students/lib/student-photo-api";
import type { RowPhotoState } from "@/features/students/lib/use-student-thumbnails";
import { cn } from "@/lib/utils";

const THUMBNAIL_CLASS = "size-10 shrink-0 rounded-md";
const PLACEHOLDER_CLASS = cn(
  THUMBNAIL_CLASS,
  "flex items-center justify-center border bg-muted text-muted-foreground",
);
const INTERACTIVE_CLASS =
  "transition outline-none hover:ring-2 hover:ring-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50";

const GALLERY_LOAD_ERROR = "לא הצלחנו לטעון את התמונות";

type RowPhotoProps = {
  studentId: string;
  studentName: string;
  photoCount: number;
  /** undefined = עדיין בטעינה */
  state: RowPhotoState | undefined;
};

/**
 * התמונה הראשית בשורה של טבלת המיועדים. לחיצה פותחת lightbox עם כל
 * הגלריה, בלי לפתוח את הכרטיס (use-row-link מתעלם מכפתורים ומ-portal).
 * כרטיס נעול מציג מנעול שפותח בקשת הרשאת צפייה - לא מגיע אליו שום קישור.
 */
export function StudentRowPhoto({
  studentId,
  studentName,
  photoCount,
  state,
}: RowPhotoProps) {
  if (photoCount <= 0) return <NoPhoto />;
  if (!state) return <Skeleton className={THUMBNAIL_CLASS} aria-hidden />;

  switch (state.status) {
    case "ok":
      return (
        <PhotoThumbnailButton
          studentId={studentId}
          studentName={studentName}
          photoCount={photoCount}
          url={state.url}
        />
      );
    case "locked":
      return <LockedThumbnail studentId={studentId} studentName={studentName} />;
    case "error":
      return <PhotoUnavailable />;
    default:
      return <NoPhoto />;
  }
}

function NoPhoto() {
  return (
    <span className={PLACEHOLDER_CLASS}>
      <ImageIcon className="size-4" aria-hidden />
      <span className="sr-only">אין תמונה</span>
    </span>
  );
}

function PhotoUnavailable() {
  return (
    <span className={PLACEHOLDER_CLASS} title={GALLERY_LOAD_ERROR}>
      <ImageOff className="size-4" aria-hidden />
      <span className="sr-only">{GALLERY_LOAD_ERROR}</span>
    </span>
  );
}

function LockedThumbnail({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`בקשת הרשאה לצפייה בתמונה: ${studentName}`}
        title="תמונה חסויה - בקשת הרשאת צפייה"
        className={cn(PLACEHOLDER_CLASS, INTERACTIVE_CLASS, "cursor-pointer")}
      >
        <Lock className="size-4" aria-hidden />
      </button>
      <PhotoRequestDialog
        studentId={studentId}
        studentName={studentName}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}

type LoadedGallery = { photos: StudentGalleryResponse["photos"]; loadedAt: number };

async function fetchGallery(studentId: string): Promise<LoadedGallery> {
  const response = await fetch(studentGalleryEndpoint(studentId), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`gallery request failed: ${response.status}`);
  }
  const body = (await response.json()) as StudentGalleryResponse;
  return { photos: body.photos ?? [], loadedAt: Date.now() };
}

function PhotoThumbnailButton({
  studentId,
  studentName,
  photoCount,
  url,
}: {
  studentId: string;
  studentName: string;
  photoCount: number;
  url: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [gallery, setGallery] = useState<LoadedGallery | null>(null);
  const [hasImageError, setHasImageError] = useState(false);

  const openGallery = async () => {
    setIsOpen(true);
    // קישורים שנחתמו לפני זמן רב יפוגו בקרוב - טוענים מחדש
    const isGalleryFresh =
      gallery !== null &&
      Date.now() - gallery.loadedAt < SIGNED_URL_CLIENT_LIFETIME_MS;
    if (isGalleryFresh) return;
    setGallery(null);
    try {
      const loaded = await fetchGallery(studentId);
      if (loaded.photos.length === 0) {
        toast.error(GALLERY_LOAD_ERROR);
        setIsOpen(false);
        return;
      }
      setGallery(loaded);
    } catch (error) {
      console.error("[students/gallery] load failed", error);
      toast.error(GALLERY_LOAD_ERROR);
      setIsOpen(false);
    }
  };

  // הקישור פג (הדף פתוח זמן רב) או שהקובץ חסר - מציגים מקום ריק ולא תמונה שבורה
  if (hasImageError) return <PhotoUnavailable />;

  return (
    <>
      <button
        type="button"
        onClick={openGallery}
        aria-label={`הצגת תמונות: ${studentName}`}
        title={photoCount > 1 ? `${photoCount} תמונות` : "הגדלת התמונה"}
        className={cn(
          THUMBNAIL_CLASS,
          INTERACTIVE_CLASS,
          "relative cursor-zoom-in overflow-hidden border bg-muted",
        )}
      >
        <img
          src={url}
          alt={studentName}
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
          className="size-full object-cover"
        />
        {photoCount > 1 && (
          <span
            aria-hidden
            className="absolute end-0 bottom-0 rounded-ss-md bg-foreground/70 px-1 text-caption text-background tabular-nums"
          >
            {photoCount}
          </span>
        )}
      </button>
      <PhotoLightbox
        photos={gallery?.photos ?? []}
        alt={studentName}
        startIndex={isOpen ? 0 : null}
        isLoading={isOpen && gallery === null}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
