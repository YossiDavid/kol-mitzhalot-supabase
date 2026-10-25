"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  addFavorite,
  readFavorites,
  removeFavorite,
} from "@/features/students/lib/favorites";

const UPDATE_ERROR = "עדכון המועדפים נכשל, נסו שוב";

/**
 * סימון/ביטול מועדף מתוך דף הכרטיס - אותה רשימה כמו הכוכב ברשימת הכרטיסים
 * (user_metadata.favorites). הכללים (למשל מאורס/נשוי) נאכפים ב-addFavorite.
 * פריט בתפריט "עוד פעולות", כדי שהדר הכרטיס יישאר מצומצם.
 */
export function FavoriteCardMenuItem({ studentId }: { studentId: string }) {
  const supabaseRef = useRef(createClient());
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supabaseRef.current.auth
      .getUser()
      .then(({ data }) => {
        if (isMounted) setIsFavorite(readFavorites(data.user).includes(studentId));
      })
      .catch((error: unknown) => {
        console.error("[favorites/card] load failed", error);
        // בלי מצב ידוע: מציגים "למועדפים", והוספה בודקת שוב מול השרת
        if (isMounted) setIsFavorite(false);
      });
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  async function toggle() {
    if (isFavorite === null || isBusy) return;
    setIsBusy(true);
    const result = isFavorite
      ? await removeFavorite(supabaseRef.current, studentId)
      : await addFavorite(supabaseRef.current, studentId);
    setIsBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? UPDATE_ERROR);
      return;
    }
    const next = result.favorites.includes(studentId);
    setIsFavorite(next);
    toast.success(next ? "נוסף למועדפים" : "הוסר מהמועדפים");
  }

  return (
    <DropdownMenuItem
      onSelect={() => void toggle()}
      disabled={isFavorite === null || isBusy}
      data-testid="card-favorite-toggle"
    >
      <Star className={cn(isFavorite && "fill-favorite text-favorite")} />
      {isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
    </DropdownMenuItem>
  );
}
