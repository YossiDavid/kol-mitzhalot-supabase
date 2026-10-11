"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { clearFavoritesMessage } from "@/features/students/lib/clear-favorites";
import { clearFavorites } from "@/features/students/lib/favorites";
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

  if (count === 0) return null;

  async function handleClear(): Promise<boolean> {
    const result = await clearFavorites(supabaseRef.current);
    if (!result.ok) {
      toast.error(CLEAR_FAILED_MESSAGE);
      return false;
    }
    toast.success("כל המועדפים נוקו");
    return true;
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
      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="ניקוי כל המועדפים"
        description={`${clearFavoritesMessage(count)} הכרטיסים עצמם לא נמחקים, ואפשר לסמן אותם שוב בכוכב.`}
        confirmLabel="ניקוי המועדפים"
        pendingLabel="מנקה..."
        onConfirm={handleClear}
        onSuccess={onCleared}
        onError={() => toast.error(CLEAR_FAILED_MESSAGE)}
      />
    </>
  );
}
