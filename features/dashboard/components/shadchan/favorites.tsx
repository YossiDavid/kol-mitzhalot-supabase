"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { User as LucideUser } from "lucide-react";
import Link from "next/link";
import { User as SupabaseUser } from "@supabase/supabase-js";

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
import { createClient } from "@/lib/supabase/client";

export default function Favorites({
  favorites,
}: {
  favorites: StudentTableRow[];
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [user, setUser] = useState<SupabaseUser | undefined>(undefined);
  const [localFavorites, setLocalFavorites] =
    useState<StudentTableRow[]>(favorites);

  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted) setUser(user || undefined);
    });
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const handleFavoriteRemove = async (id: string) => {
    const currentFavs: string[] = user?.user_metadata?.favorites || [];
    const nextFavs = currentFavs.filter((fid) => fid !== id);
    const { data, error } = await supabase.auth.updateUser({
      data: { favorites: nextFavs },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setUser(data.user || undefined);
      setLocalFavorites((prev) => prev.filter((fav) => fav.id !== id));
    }

    toast.success("המיועד הוסר מהמועדפים");
  };

  return (
    <StudentsTable
      preset="favorites"
      className="pt-4"
      caption="המועדפים שלך"
      students={localFavorites}
      onRemoveFavorite={handleFavoriteRemove}
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
  );
}
