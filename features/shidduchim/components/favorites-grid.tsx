"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart } from "lucide-react";

import StudentBox from "./student-box";
import type { Student } from "./student-box";
import calculateAge from "@/lib/calculateAge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialFavorites: Student[];
  onAddMale: (student: Student) => void;
  onAddFemale: (student: Student) => void;
  onDragGenderChange: (gender: "male" | "female" | null) => void;
  onFavoritesChanged?: () => void;
};

function mapEmploymentToHebrew(
  category: string,
  gender: "male" | "female",
): string {
  switch (category) {
    case "yeshiva":
      return "בחור ישיבה";
    case "seminar":
      return "לומדת בסמינר";
    case "at_home":
      return "בבית";
    case "havruta":
      return "לומד עם חברותא";
    case "kolel":
      return "כולל";
    case "profession":
      return gender === "male" ? "לומד מקצוע" : "לומדת מקצוע";
    case "working":
      return gender === "male" ? "עובד" : "עובדת";
    default:
      return "";
  }
}

export default function FavoritesGrid({
  initialFavorites,
  onAddMale,
  onAddFemale,
  onDragGenderChange,
  onFavoritesChanged,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [favorites, setFavorites] = useState<Student[]>(initialFavorites);
  const [activeTab, setActiveTab] = useState<"male" | "female">("male");

  useEffect(() => {
    setFavorites(initialFavorites);
  }, [initialFavorites]);

  const toggleTab = () =>
    setActiveTab((prev) => (prev === "male" ? "female" : "male"));

  const handleAddToDesk = (student: Student) => {
    student.gender === "male" ? onAddMale(student) : onAddFemale(student);
  };

  const handleRemoveFromFavorites = async (student: Student) => {
    const nextFavorites = favorites.filter((s) => s.id !== student.id);

    const { error } = await supabase.auth.updateUser({
      data: { favorites: nextFavorites.map((s) => s.id) },
    });

    if (error) {
      toast.error("שגיאה בהסרת המועדף");
      return;
    }

    setFavorites(nextFavorites);
    router.refresh();
    onFavoritesChanged?.();
  };

  const filtered = favorites.filter((item) => item.gender === activeTab);

  return (
    <div className="mt-8">
      {/* Tab switcher */}
      <div
        className={cn(
          "before:bg-primary relative mx-auto flex w-fit cursor-pointer gap-2 rounded-full bg-white p-2 select-none",
          "before:absolute before:top-0 before:left-0 before:h-full before:w-1/2 before:rounded-full before:border-4 before:border-white before:transition-all before:duration-300",
          activeTab === "male" ? "before:translate-x-full" : "",
        )}
        onClick={toggleTab}
        role="tablist"
        aria-label="סינון לפי מגדר"
      >
        <div
          role="tab"
          aria-selected={activeTab === "male"}
          className={cn(
            "z-10 min-w-32 p-2 text-center text-sm font-medium",
            activeTab === "male" ? "text-white" : "text-muted-foreground",
          )}
        >
          מיועדים
        </div>
        <div
          role="tab"
          aria-selected={activeTab === "female"}
          className={cn(
            "z-10 min-w-32 p-2 text-center text-sm font-medium",
            activeTab === "female" ? "text-white" : "text-muted-foreground",
          )}
        >
          מיועדות
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center gap-2 py-10 text-center">
            <Heart className="text-muted-foreground/30 size-10" />
            <p className="text-muted-foreground text-sm">
              אין {activeTab === "male" ? "מיועדים" : "מיועדות"} במועדפים
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <StudentBox
              key={item.id}
              gender={item.gender}
              firstName={item.first_name}
              lastName={item.last_name}
              age={Number(calculateAge(item.birth_date))}
              city={item.city}
              doingToday={item.employment_history?.map((emp) =>
                mapEmploymentToHebrew(emp.category, item.gender),
              )}
              father={{
                name: `${item.parents_info?.father?.self?.name || ""} ${item.parents_info?.father?.self?.suffix || ""}`.trim(),
                position: item.parents_info?.father?.job || "",
              }}
              mother={{
                name: `${item.parents_info?.mother?.self?.name || ""} ${item.parents_info?.mother?.self?.suffix || ""}`.trim(),
                position: item.parents_info?.mother?.job || "",
                maidenName: item.parents_info?.mother?.maidenName || "",
              }}
              item={item}
              draggable
              onDragEnter={() => onDragGenderChange(item.gender)}
              onDragEnd={() => onDragGenderChange(null)}
              setDraggingGender={onDragGenderChange}
            >
              <StudentBox.AddToDesk onClick={handleAddToDesk} />
              <div className="grid grid-cols-2 gap-2">
                <StudentBox.ViewProfile />
                <StudentBox.RemoveFromFavorites
                  onClick={handleRemoveFromFavorites}
                />
              </div>
            </StudentBox>
          ))
        )}
      </div>
    </div>
  );
}
