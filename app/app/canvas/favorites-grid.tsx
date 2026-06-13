"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudentBox from "./student-box";
import calculateAge from "@/lib/calculateAge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Student = {
  id: string;
  gender: "male" | "female";
  first_name: string;
  last_name: string;
  birth_date: string | Date;
  city: string;
  parents_info?: any;
  employment_history?: { category: string }[];
};

type Props = {
  initialFavorites: Student[];
  onAddMale: (student: Student) => void;
  onAddFemale: (student: Student) => void;
  onDragGenderChange: (gender: "male" | "female" | null) => void;
  onFavoritesChanged?: () => void;

};

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

  // חשוב: סנכרון כשה־props משתנים (אחרי router.refresh)
  useEffect(() => {
    setFavorites(initialFavorites);
  }, [initialFavorites]);

  const toggleTab = () =>
    setActiveTab((prev) => (prev === "male" ? "female" : "male"));

  const handleAddToDesk = (student: Student) => {
    student.gender === "male" ? onAddMale(student) : onAddFemale(student);
  };

  // ===== הסרה ממועדפים =====
  const handleRemoveFromFavorites = async (student: Student) => {
    const nextFavorites = favorites.filter((s) => s.id !== student.id);

    const { error } = await supabase.auth.updateUser({
      data: {
        favorites: nextFavorites.map((s) => s.id), // ← רק IDs
      },
    });

    if (error) {
      console.warn(error);
      return;
    }

    // UI מיידי
    setFavorites(nextFavorites);

    // רענון Server Components (כולל CanvasPage)
    router.refresh();
    onFavoritesChanged?.();
  };

  return (
    <div className="mt-8">
      {/* טאבים */}
      <div
        className={cn(
          "before:bg-primary relative mx-auto flex w-fit cursor-pointer gap-2 rounded-full bg-white p-2 select-none before:absolute before:top-0 before:left-0 before:h-full before:w-1/2 before:rounded-full before:border-4 before:border-white before:transition-all before:duration-300",
          activeTab === "male" ? "before:translate-x-full" : ""
        )}
        onClick={toggleTab}
      >
        <div className={`z-10 min-w-32 p-2 text-center ${activeTab === "male" ? "text-white" : "text-gray-500"}`}>
          מיועדים
        </div>
        <div className={`z-10 min-w-32 p-2 text-center ${activeTab === "female" ? "text-white" : "text-gray-500"}`}>
          מיועדות
        </div>
      </div>

      {/* גריד */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {favorites
          .filter((item) => item.gender === activeTab)
          .map((item) => (
            <StudentBox
              key={item.id}
              gender={item.gender}
              firstName={item.first_name}
              lastName={item.last_name}
              age={Number(calculateAge(item.birth_date))}
              city={item.city}
              doingToday={item.employment_history?.map((emp) => {
                switch (emp.category) {
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
                    return item.gender === "male" ? "לומד מקצוע" : "לומדת מקצוע";
                  case "working":
                    return item.gender === "male" ? "עובד" : "עובדת";
                  default:
                    return "";
                }
              })}
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
              onAddToDesk={handleAddToDesk}
              onRemoveFromFavorites={handleRemoveFromFavorites}
              favorites
            />
          ))}
      </div>
    </div>
  );
}
