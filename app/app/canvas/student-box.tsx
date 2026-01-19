"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CirclePlus, FileCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Student = {
  id: string;
  gender: "male" | "female";
  first_name: string;
  last_name: string;
  birth_date: string | Date;
  city: string;
  parents_info?: {
    father?: {
      self?: {
        name?: string;
        suffix?: string;
      };
      job?: string;
    };
    mother?: {
      self?: {
        name?: string;
        suffix?: string;
      };
      job?: string;
      maidenName?: string;
    };
  };
  employment_history?: Array<{
    category: string;
  }>;
};

// מאפשר לקבל כל prop חוקי של div כולל onDragEnter/onDragStart וכו'
type StudentBoxProps = React.HTMLAttributes<HTMLDivElement> & {
  gender: "male" | "female";
  firstName?: string;
  lastName?: string;
  age?: number;
  city?: string;
  doingToday?: string[];
  father?: { name: string; position: string };
  mother?: { name: string; maidenName?: string; position: string };
  student?: string; // demo
  data?: { age: number; city: string; where: string; what: string };

  onAddToDesk?: (student: Student) => void;
  onRemoveFromDesk?: () => void;
  onRemoveFromFavorites?: (student: Student) => void;

  draggable?: boolean;
  item?: Student;

  favorites?: boolean;

  setDraggingGender?: (gender: "male" | "female" | null) => void;
};

function StudentBox({
  favorites = false,
  className,
  gender,
  firstName,
  lastName,
  age,
  city,
  doingToday,
  father,
  mother,
  student,
  data,
  onAddToDesk,
  onRemoveFromDesk,
  onRemoveFromFavorites,
  draggable,
  item,
  setDraggingGender,
  ...divProps
}: StudentBoxProps) {
  const subtitle = [age, city, doingToday?.join(",")];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // 1) קודם כל: אם ההורה העביר onDragStart – נקרא לו
    divProps.onDragStart?.(e);

    if (!draggable) return;

    // 2) תמיד תכלול gender בתוך ה payload כדי שה drop יעבוד
    const payload = JSON.stringify({
      ...(item ?? {}),
      gender,
    });

    e.dataTransfer.setData("application/json", payload);
    setDraggingGender?.(gender);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    divProps.onDragEnd?.(e);
    setDraggingGender?.(null);
  };

  return (
    <div
      {...divProps}
      className={cn(
        "rounded-md bg-white p-4",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* שם התלמיד */}
      {student ?? `${firstName ?? ""} ${lastName ?? ""}`}

      {/* מה עושה היום */}
      {doingToday?.length ? (
        <div>{subtitle.filter((d) => d && d !== "").join(" | ")}</div>
      ) : null}

      {/* הורים */}
      <div className="rounded-lg bg-gray-200 p-2">
        {father && (
          <div>
            <b>אב: </b>
            {Object.values(father)
              .filter((data) => (typeof data === "string" ? data.length > 0 : true))
              .join(" | ")}
          </div>
        )}
        {mother && (
          <div>
            <b>אם: </b>
            {Object.values(mother)
              .filter((data) => (typeof data === "string" ? data.length > 0 : true))
              .join(" | ")}
          </div>
        )}
      </div>

      {/* כפתור הוספה אם מדובר בפייבוריט */}
      {favorites && (
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={() => onAddToDesk?.(item!)}
        >
          הוספת כרטיס לשידוך
          <CirclePlus />
        </Button>
      )}

      {/* כפתורים כלליים */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" asChild>
          <Link href={`/app/students/${item?.id}`}>
            צפיה בקו״ח
            <FileCheck />
          </Link>
        </Button>

        {draggable ? (
          <Button
            variant="destructiveOutline"
            onClick={() => onRemoveFromFavorites?.(item!)}
          >
            הסרה מהמועדפים
            <X />
          </Button>
        ) : (
          <Button variant="destructiveOutline" onClick={onRemoveFromDesk}>
            הסרה מהשידוך
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}

export default StudentBox;
