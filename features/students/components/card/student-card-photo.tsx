import { ImageIcon, Lock } from "lucide-react";

import LockedStudentPhoto from "@/features/students/components/student-photo";
import StudentPhotoGallery from "@/features/students/components/student-photo-gallery";
import type { StudentPhotoView } from "@/features/students/lib/student-photos";

const AVATAR_CLASS =
  "flex h-20 w-20 items-center justify-center rounded-full border bg-muted sm:h-24 sm:w-24";

function PhotoPlaceholder({ shrink }: { shrink?: boolean }) {
  return (
    <div className={shrink ? `${AVATAR_CLASS} shrink-0` : AVATAR_CLASS}>
      <ImageIcon className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

/**
 * התמונה בראש הכרטיס למשתמש מחובר. בלי הרשאה (`photoPrivate`) מוצג מנעול
 * שלחיצה עליו פותחת בקשת צפייה - אף קישור חתום לא נוצר בצד השרת.
 */
export function StudentCardPhoto({
  studentId,
  alt,
  photoCount,
  photoPrivate,
  photos,
}: {
  studentId: string;
  alt: string;
  photoCount: number;
  photoPrivate: boolean;
  photos: StudentPhotoView[];
}) {
  if (photoCount === 0) return <PhotoPlaceholder />;
  if (photoPrivate)
    return <LockedStudentPhoto studentId={studentId} alt={alt} />;
  return <StudentPhotoGallery photos={photos} alt={alt} />;
}

/**
 * התמונה בתצוגה הציבורית (קישור שיתוף, גולש לא מחובר). כלל מוחלט: אצל בת
 * לעולם לא מוצגת תמונה - הגלריה נטענת ונחתמת רק לבן, ולבת לא נוצר אף קישור.
 */
export function PublicStudentCardPhoto({
  alt,
  isFemale,
  photos,
}: {
  alt: string;
  isFemale: boolean;
  photos: StudentPhotoView[];
}) {
  if (isFemale) {
    return (
      <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border bg-muted sm:h-24 sm:w-24">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <span className="text-caption text-muted-foreground">חסוי</span>
      </div>
    );
  }
  if (photos.length > 0) {
    return <StudentPhotoGallery photos={photos} alt={alt} />;
  }
  return <PhotoPlaceholder shrink />;
}
