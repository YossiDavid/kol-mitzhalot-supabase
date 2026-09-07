// טיפוסים ותוויות משותפים לבקשות צפייה בתמונה (public.photo_view_requests).
// יושב ב-lib ולא בתוך אחד הרכיבים כי גם דיאלוג הבקשה (צד השדכן) וגם מסך
// ההכרעה של המנהל מציגים את אותם סטטוסים, ואסור שהתרגום לעברית יתפצל לשתי
// גרסאות שיזלגו זו מזו עם הזמן.

export type PhotoRequestStatus = "pending" | "approved" | "rejected";

export type PhotoViewRequest = {
  id: string;
  requester_id: string;
  student_id: string;
  status: PhotoRequestStatus;
  reason: string | null;
  created_at: string;
};

export const PHOTO_REQUEST_STATUS_LABELS: Record<PhotoRequestStatus, string> = {
  pending: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
};

/** שגיאת מפתח כפול של Postgres — בקשה לאותה מיועדת כבר קיימת. */
export const UNIQUE_VIOLATION_CODE = "23505";
