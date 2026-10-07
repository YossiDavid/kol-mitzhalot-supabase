"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearAllFavorites,
  clearFavoritesMessage,
} from "@/features/students/lib/clear-favorites";
import { createClient } from "@/lib/supabase/client";

const CLEAR_FAILED_MESSAGE = "לא הצלחנו לנקות את המועדפים. נסו שוב.";

/**
 * "ניקוי כל המועדפים": כפתור עם דיאלוג אישור שמציין כמה יוסרו. מוסתר כשאין
 * מועדפים. הקורא מעדכן את המסך ב-onCleared מיד אחרי ההצלחה.
 */
export function ClearFavoritesButton({
  count,
  onCleared,
}: {
  count: number;
  onCleared: () => void;
}) {
  const supabaseRef = useRef(createClient());
  const [isOpen, setIsOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (count === 0) return null;

  async function handleClear() {
    setIsClearing(true);
    try {
      const errorMessage = await clearAllFavorites(supabaseRef.current);
      if (errorMessage) {
        console.error("[favorites] clear failed:", errorMessage);
        toast.error(CLEAR_FAILED_MESSAGE);
        return;
      }
      toast.success("כל המועדפים נוקו");
      setIsOpen(false);
      onCleared();
    } catch (error: unknown) {
      console.error("[favorites] clear failed:", error);
      toast.error(CLEAR_FAILED_MESSAGE);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        data-testid="clear-favorites"
      >
        <Trash2 />
        ניקוי כל המועדפים
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>ניקוי כל המועדפים</DialogTitle>
            <DialogDescription>
              {clearFavoritesMessage(count)} הכרטיסים עצמם לא נמחקים, ואפשר לסמן
              אותם שוב בכוכב.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isClearing}
            >
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={isClearing}
            >
              {isClearing ? "מנקה..." : "ניקוי המועדפים"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
