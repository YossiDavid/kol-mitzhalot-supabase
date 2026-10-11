"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { User as LucideUser } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  StudentsTable,
  type StudentTableRow,
} from "@/features/students/components/students-table";
import { ClearFavoritesButton } from "@/features/students/components/clear-favorites-button";
import { removeFavorite } from "@/features/students/lib/favorites";
import { createClient } from "@/lib/supabase/client";

import { SectionLoadFailed } from "../section-load-failed";

/** הודעה קבועה למשתמש כשהסרת מועדף נכשלה (הפרטים הטכניים נרשמים בקונסול) */
const REMOVE_FAVORITE_ERROR = "הסרת המיועד מהמועדפים נכשלה, נסו שוב";

export default function Favorites({
  favorites,
  failed = false,
}: {
  favorites: StudentTableRow[];
  /** השליפה נכשלה: מציגים הודעת שגיאה ולא "עוד לא הוספת מועדפים" */
  failed?: boolean;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [localFavorites, setLocalFavorites] =
    useState<StudentTableRow[]>(favorites);

  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);

  const handleFavoriteRemove = async (id: string) => {
    const result = await removeFavorite(supabase, id);

    if (!result.ok) {
      toast.error(REMOVE_FAVORITE_ERROR);
      return;
    }

    setLocalFavorites((prev) => prev.filter((fav) => fav.id !== id));
    toast.success("המיועד הוסר מהמועדפים");
  };

  if (failed) {
    return <SectionLoadFailed title="לא הצלחנו לטעון את המועדפים" />;
  }

  return (
    <>
      <div className="flex justify-end pt-2">
        <ClearFavoritesButton
          count={localFavorites.length}
          onCleared={() => setLocalFavorites([])}
        />
      </div>
      <StudentsTable
        preset="favorites"
        className="pt-4"
        caption="המועדפים שלך"
        students={localFavorites}
        onRemoveFavorite={handleFavoriteRemove}
        onCvAdded={(id, cvUrl) =>
          setLocalFavorites((prev) =>
            prev.map((fav) =>
              fav.id === id ? { ...fav, cv_url: cvUrl } : fav,
            ),
          )
        }
        emptyState={
          <Empty size="compact">
            <EmptyHeader>
              <EmptyTitle>עוד לא הוספת שמות מועדפים ללוח העבודה</EmptyTitle>
              <EmptyDescription>
                שמות שמסמנים בכוכב יופיעו פה ובלוח העבודה ואפשר ליצור מהם הצעה
                לשידוך.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/app/students">
                  <LucideUser />
                  לרשימת המיועדים
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        }
      />
    </>
  );
}
