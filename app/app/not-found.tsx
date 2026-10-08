import { NotFoundContent } from "@/components/not-found-content";

/**
 * 404 בתוך מעטפת האפליקציה (סרגל צד והדר): מוצג כש-notFound() נזרק מדף
 * שנמצא תחת /app (כרטיס, הצעה, פוסט שלא נמצאו). כתובת שלא תואמת אף נתיב
 * מקבלת את ה-404 הגלובלי: נתיב כללי (catch-all) תחת /app שבר את טבלת
 * הנתיבים כולה בהפעלה נקייה של השרת, ולכן אין להוסיף כזה.
 */
export default function AppNotFound() {
  return <NotFoundContent className="min-h-[60svh]" />;
}
