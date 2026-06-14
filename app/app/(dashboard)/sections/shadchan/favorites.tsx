"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { User as LucideUser } from "lucide-react";
import Link from "next/link";
import { User as SupabaseUser } from "@supabase/supabase-js";

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

type Favorite = {
  id: string;
  last_name: string;
  first_name: string;
  description: string;
  image: string;
  permalink: string;
  personal_status: "married" | "engaged" | "single";
  parents_info?: {
    father?: { self?: { prefix?: string; name?: string; suffix?: string } };
    mother?: { self?: { prefix?: string; name?: string; suffix?: string } };
  };
  city: string;
  birth_date: Date;
  height: number;
  cv_url?: string;
};

function parseStatus(status: string): string {
  if (status === "married") return "נשוי";
  if (status === "engaged") return "מאורס";
  if (status === "single") return "רווק";
  if (status === "divorced") return "גרוש";
  if (status === "widowed") return "אלמן";
  return status;
}

export default function Favorites({ favorites }: { favorites: Favorite[] }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [user, setUser] = useState<SupabaseUser | undefined>(undefined);
  const [localFavorites, setLocalFavorites] = useState<Favorite[]>(favorites);

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

  const handleFavoriteChange = async (checked: boolean, id: string) => {
    const currentFavs: string[] = user?.user_metadata?.favorites || [];
    const nextFavs = checked
      ? [...currentFavs, id]
      : currentFavs.filter((fid) => fid !== id);

    const { data, error } = await supabase.auth.updateUser({
      data: { favorites: nextFavs },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setUser(data.user || undefined);
      if (!checked) {
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
        <>
          {/* כרטיסים — מובייל */}
          <div className="flex flex-col gap-3 pt-4 md:hidden">
            {localFavorites.map((favorite) => (
              <Box key={favorite.id} className="flex flex-col gap-3 p-4">
                <span className="font-semibold">
                  {favorite.first_name} {favorite.last_name}
                </span>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">מועדף</span>
                  <Switch
                    checked={true}
                    onCheckedChange={(e) =>
                      handleFavoriteChange(e, favorite.id)
                    }
                  />
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span>{parseStatus(favorite.personal_status)}</span>
                  <span>
                    גיל {calculateAge(new Date(favorite.birth_date || ""))}
                  </span>
                  {favorite.city && <span>{favorite.city}</span>}
                  {favorite.height && <span>{favorite.height} ס״מ</span>}
                </div>
                <div className="flex gap-2">
                  {favorite.cv_url ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <a
                        href={favorite.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Link href={"/" as any}>הוספת קו״ח</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/app/students/${favorite.id}`}>כרטיס מלא</Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>

          {/* טבלה — דסקטופ */}
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_3fr] md:gap-4 md:pt-4">
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
            {localFavorites.map((favorite) => (
              <Box
                key={favorite.id}
                className="col-span-full grid grid-cols-subgrid items-center p-4"
              >
                <div>
                  <Switch
                    checked={true}
                    onCheckedChange={(e) =>
                      handleFavoriteChange(e, favorite.id)
                    }
                  />
                </div>
                <div>{parseStatus(favorite.personal_status)}</div>
                <div>{favorite.last_name}</div>
                <div>{favorite.first_name}</div>
                <div>
                  {favorite.parents_info?.father?.self?.prefix || ""}{" "}
                  {favorite.parents_info?.father?.self?.name || ""}
                </div>
                <div>
                  {favorite.parents_info?.mother?.self?.prefix || ""}{" "}
                  {favorite.parents_info?.mother?.self?.name || ""}
                </div>
                <div>{favorite.city}</div>
                <div>{calculateAge(new Date(favorite.birth_date || ""))}</div>
                <div>{favorite.height}</div>
                <div className="flex gap-1">
                  {favorite.cv_url ? (
                    <Button asChild className="flex-1" variant="outline">
                      <a
                        href={favorite.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        כרטיס קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="flex-1" variant="outline">
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
        </>
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
                <LucideUser />
                לרשימת המיועדים
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
