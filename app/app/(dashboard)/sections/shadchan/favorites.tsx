"use client";

import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import calculateAge from "@/lib/calculateAge";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Favorite = {
  id: string;
  last_name: string;
  first_name: string;
  description: string;
  image: string;
  permalink: string;
  personal_status: "married" | "engaged" | "single";
  parents_info?: {
    father?: {
      self?: {
        prefix?: string;
        name?: string;
        suffix?: string;
      };
    };
    mother?: {
      self?: {
        prefix?: string;
        name?: string;
        suffix?: string;
      };
    };
  };
  city: string;
  birth_date: Date;
  height: number;
  cv_url?: string;
};

export default function Favorites({ favorites }: { favorites: Favorite[] }) {
  const [user, setUser] = useState<SupabaseUser | undefined>(undefined);
  const [localFavorites, setLocalFavorites] = useState<Favorite[]>(favorites);

  const parseStatus = (status: Favorite["personal_status"]) => {
    if (status === "married") return "נשוי";
    if (status === "engaged") return "מאורס";
    if (status === "single") return "רווק";
    if (status === "divorced") return "גרוש";
    if (status === "widowed") return "אלמן";
  };

  const supabase = createClient();

  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user || undefined);
    }
    fetchUser();
  }, []);

  // עדכון הרשימה המקומית כשהפרופ משתנה
  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);

  const handleFavoriteChange = async (e: boolean, id: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        favorites: e
          ? [...(user?.user_metadata?.favorites || ([] as string[])), id]
          : (user?.user_metadata?.favorites || ([] as string[])).filter(
              (favoriteId: string) => favoriteId !== id,
            ),
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setUser(data.user || undefined);

      // עדכון הרשימה המקומית - הסרת המיועד מהרשימה
      if (!e) {
        setLocalFavorites((prev) => prev.filter((fav) => fav.id !== id));
        toast.success("המיועד הוסר מהמועדפים");
      } else {
        toast.success("המיועד נוסף למועדפים");
      }
    }
  };

  return (
    <>
      {localFavorites.length > 0 ? (
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_3fr] gap-4 pt-4">
          <div
            data-slot="table-header"
            className="col-span-full grid grid-cols-subgrid"
          >
            <div>מועדף</div>
            <div>סטטוס</div>
            <div>שם משפחה</div>
            <div>שם פרטי</div>
            <div>שם האב</div>
            <div>שם האם</div>
            <div>עיר</div>
            <div>גיל</div>
            <div>גובה</div>
          </div>
          {localFavorites.map((favorite, index) => (
            <Box
              key={index}
              className="col-span-full grid grid-cols-subgrid items-center p-4"
            >
              <div>
                <Switch
                  checked={true}
                  onCheckedChange={(e) => handleFavoriteChange(e, favorite.id)}
                />
              </div>
              <div>{parseStatus(favorite.personal_status)}</div>
              <div>{favorite.last_name}</div>
              <div>{favorite.first_name}</div>
              <div>
                {favorite.parents_info?.father?.self?.prefix || ""}{" "}
                {favorite.parents_info?.father?.self?.name || ""}{" "}
                {/* {student.parents_info.father.self.suffix} */}
              </div>
              <div>
                {favorite.parents_info?.mother?.self?.prefix || ""}{" "}
                {favorite.parents_info?.mother?.self?.name || ""}{" "}
                {/* {student.parents_info.mother.self.suffix} */}
              </div>
              <div>{favorite.city}</div>
              <div>{calculateAge(new Date(favorite.birth_date || ""))}</div>
              <div>{favorite.height}</div>
              <div className="flex gap-1">
                {favorite.cv_url ? (
                  <Button asChild className="flex-1" variant={"outline"}>
                    <a
                      href={favorite.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      כרטיס קו״ח
                    </a>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="flex-1 bg-amber-100"
                    variant={"outline"}
                  >
                    <Link href={"/" as any}>להוספת קו״ח</Link>
                  </Button>
                )}
                <Button asChild className="flex-1">
                  <Link href={`/app/students/${favorite.id}`}>
                    לצפיה בכרטיס המלא
                  </Link>
                </Button>
              </div>
            </Box>
          ))}
        </div>
      ) : (
        <Empty>
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
                <User />
                לרשימת המיועדים
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
