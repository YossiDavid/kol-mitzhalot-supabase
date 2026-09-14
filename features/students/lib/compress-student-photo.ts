import {
  MAX_PHOTO_DIMENSION_PX,
  MAX_STUDENT_PHOTO_BYTES,
  MAX_STUDENT_PHOTO_MB,
} from "@/features/students/lib/student-photo-rules";

/**
 * הקטנת תמונת מיועד בדפדפן, לפני ההעלאה.
 *
 * למה בדפדפן ולא ב-sharp בשרת: ההעלאה נעשית ישירות מהדפדפן לאחסון, ומעבר
 * דרך route בשרת היה נתקל במגבלת גודל הבקשה (4.5MB ב-Vercel) - בדיוק בתמונות
 * הגדולות שרוצים להקטין.
 *
 * הקידוד מחדש ל-JPEG גם מסיר את נתוני ה-EXIF, כולל מיקום GPS שתמונות טלפון
 * נושאות. אם התוצאה עדיין גדולה מהמותר, יורדים קודם באיכות ואז במידות.
 */

const OUTPUT_TYPE = "image/jpeg";
const OUTPUT_EXTENSION = "jpg";
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55] as const;
/** כמה מקטינים את הצלע הארוכה בכל סבב, כשהורדת האיכות לא הספיקה */
const DIMENSION_STEP = 0.8;
/** מתחת לזה התמונה כבר לא שימושית, ועדיף להודיע שלא הצלחנו */
const MIN_DIMENSION_PX = 600;
/** JPEG אינו תומך בשקיפות - רקע לבן במקום שחור */
const BACKGROUND_COLOR = "#ffffff";

export class PhotoCompressionError extends Error {}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoCompressionError(`לא הצלחנו לקרוא את התמונה ${file.name}`);
  }
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, OUTPUT_TYPE, quality));
}

async function encodeJpeg(
  image: ImageBitmap,
  maxDimension: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new PhotoCompressionError("הדפדפן אינו מאפשר עיבוד תמונות");
  }

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToJpeg(canvas, quality);
  if (!blob) throw new PhotoCompressionError("עיבוד התמונה נכשל");
  return blob;
}

function toJpegFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${baseName}.${OUTPUT_EXTENSION}`;
}

/**
 * מחזיר JPEG שקטן מ-MAX_STUDENT_PHOTO_MB, או זורק PhotoCompressionError
 * עם הודעה בעברית.
 */
export async function compressStudentPhoto(file: File): Promise<File> {
  const image = await decodeImage(file);

  try {
    for (
      let dimension = MAX_PHOTO_DIMENSION_PX;
      dimension >= MIN_DIMENSION_PX;
      dimension = Math.round(dimension * DIMENSION_STEP)
    ) {
      for (const quality of JPEG_QUALITIES) {
        const blob = await encodeJpeg(image, dimension, quality);
        if (blob.size <= MAX_STUDENT_PHOTO_BYTES) {
          return new File([blob], toJpegFileName(file.name), {
            type: OUTPUT_TYPE,
            lastModified: Date.now(),
          });
        }
      }
    }
  } finally {
    image.close();
  }

  throw new PhotoCompressionError(
    `לא הצלחנו להקטין את ${file.name} מתחת ל-${MAX_STUDENT_PHOTO_MB}MB`,
  );
}
