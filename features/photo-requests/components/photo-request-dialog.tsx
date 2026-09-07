"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Lock, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  UNIQUE_VIOLATION_CODE,
  type PhotoRequestStatus,
} from "@/features/photo-requests/lib/photo-request-status";

interface PhotoRequestDialogProps {
  studentId: string;
  /** שם המיועדת, לתצוגה בלבד — כדי שהמנהל והמבקש ידברו על אותו כרטיס. */
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** אין בקשה בכלל (מצב התחלתי), או אחד משלושת סטטוסי הבקשה הקיימת. */
type RequestState = "none" | PhotoRequestStatus;

const REASON_MAX_LENGTH = 500;

/**
 * דיאלוג בקשת צפייה בתמונת מיועדת.
 *
 * הדיאלוג אינו חושף את התמונה בעצמו ואינו יכול לחשוף אותה: השרת לא שולח
 * image_url של בת ללקוח כלל (ראה buildPublicStudent ב-
 * app/app/students/[id]/page.tsx), ולכן גם אחרי אישור התמונה מגיעה רק
 * בטעינה מחדש של הדף מהשרת — ומכאן ה-router.refresh() במצב "אושר".
 */
export function PhotoRequestDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: PhotoRequestDialogProps) {
  const router = useRouter();
  const [state, setState] = useState<RequestState>("none");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  // הבקשה נטענת רק כשהדיאלוג נפתח בפועל: כרטיס מיועדת נטען הרבה יותר
  // מאשר נלחץ, ואין טעם לשאילתה לכל צפייה בכרטיס.
  const loadRequest = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    // אין סינון על requester_id — מדיניות ה-RLS על photo_view_requests
    // מחזירה למשתמש רגיל את השורות שלו בלבד, וסינון נוסף כאן רק היה
    // מכפיל את הכלל במקום שני.
    const { data, error } = await supabase
      .from("photo_view_requests")
      .select("status")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      console.error("[photo-requests] load", error);
      toast.error("שגיאה בטעינת סטטוס הבקשה");
      setState("none");
      setLoading(false);
      return;
    }

    setState((data?.status as PhotoRequestStatus | undefined) ?? "none");
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    if (!open) return;
    loadRequest();
  }, [open, loadRequest]);

  async function handleSubmit() {
    setSubmitting(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("יש להתחבר מחדש כדי לשלוח בקשה");
      setSubmitting(false);
      return;
    }

    const trimmedReason = reason.trim();
    const { error } = await supabase.from("photo_view_requests").insert({
      requester_id: user.id,
      student_id: studentId,
      reason: trimmedReason || null,
    });

    if (error) {
      // מפתח כפול = כבר קיימת בקשה לאותה מיועדת (למשל נפתחה בלשונית אחרת).
      // זו לא באמת שגיאה מבחינת המשתמש — מרעננים ומציגים את הסטטוס האמיתי.
      if (error.code === UNIQUE_VIOLATION_CODE) {
        await loadRequest();
        setSubmitting(false);
        return;
      }
      console.error("[photo-requests] insert", error);
      toast.error(`שגיאה בשליחת הבקשה: ${error.message}`);
      setSubmitting(false);
      return;
    }

    toast.success("הבקשה נשלחה לאישור מנהל");
    setReason("");
    setState("pending");
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right">
        <DialogHeader>
          <DialogTitle>צפייה בתמונה</DialogTitle>
          <DialogDescription>
            תמונה של מיועדת אינה מוצגת כברירת מחדל. ניתן לבקש הרשאת צפייה לכרטיס
            של {studentName}, ומנהל יאשר או ידחה את הבקשה.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-body-sm text-muted-foreground">
            טוען...
          </p>
        ) : state === "pending" ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">הבקשה ממתינה לאישור</p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                כבר שלחת בקשה לכרטיס הזה. תקבל התראה ברגע שמנהל יכריע.
              </p>
            </div>
          </div>
        ) : state === "approved" ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-medium">הבקשה אושרה</p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                יש לרענן את הדף כדי לטעון את התמונה מהשרת.
              </p>
            </div>
          </div>
        ) : state === "rejected" ? (
          <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">הבקשה נדחתה</p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                מנהל בדק את הבקשה ולא אישר אותה. לפנייה נוספת יש לפנות למנהל
                המערכת.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-body-sm text-muted-foreground">
                התמונה חסויה. שליחת בקשה תיצור התראה למנהלי המערכת.
              </p>
            </div>
            <div>
              <Label htmlFor="photoRequestReason">נימוק (לא חובה)</Label>
              <Textarea
                id="photoRequestReason"
                className="mt-1"
                rows={3}
                maxLength={REASON_MAX_LENGTH}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="לדוגמה: בבדיקת התאמה מול מיועד ספציפי"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            סגירה
          </Button>
          {!loading && state === "none" && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "שולח..." : "שליחת בקשה"}
            </Button>
          )}
          {!loading && state === "approved" && (
            <Button
              onClick={() => {
                router.refresh();
                onOpenChange(false);
              }}
            >
              רענון הדף
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
