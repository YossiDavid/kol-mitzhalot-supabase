"use client";

import { Button } from "@/components/ui/button";
import { CirclePlus, FileCheck, X } from "lucide-react";
import React from "react";
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

type StudentBoxProps = {
  gender: "male" | "female";
  firstName?: string;
  lastName?: string;
  age?: number;
  city?: string;
  doingToday?: string[];
  father?: { name: string; position: string };
  mother?: { name: string; maidenName?: string; position: string };
  student?: string; // לשימוש בתצוגת demo
  data?: { age: number; city: string; where: string; what: string };
  onAddToDesk?: (student: Student) => void;
  onRemoveFromDesk?: () => void;
  onRemoveFromFavorites?: (student: Student) => void;
  draggable?: boolean;
  item?: Student;
  favorites?: boolean; // ✅ הוספנו
  setDraggingGender?: (gender: "male" | "female" | null) => void;
};

function StudentBox({ favorites = false, ...props }: StudentBoxProps) {
  const subtitle = [props.age, props.city, props.doingToday?.join(",")];

  return (
    <div
      className={cn(
        "rounded-md bg-white p-4",
        props.draggable && "cursor-grab active:cursor-grabbing",
      )}
      draggable={props.draggable}
      onDragStart={(e) => {
        const data = JSON.stringify(props.item);
        e.dataTransfer.setData("application/json", data);
        props.setDraggingGender?.(props.gender); // ⬅️ כאן שמור את המגדר
      }}
      onDragEnd={() => {
        props.setDraggingGender?.(null);
      }}
    >
      {/* שם התלמיד */}
      {props.student ?? `${props.firstName ?? ""} ${props.lastName ?? ""}`}

      {/* מה עושה היום */}
      {props.doingToday?.length ? (
        <div>{subtitle.filter((d) => d && d !== "").join(" | ")}</div>
      ) : null}

      {/* הורים */}
      <div className="rounded-lg bg-gray-200 p-2">
        {props.father && (
          <div>
            <b>אב: </b>
            {Object.values(props.father)
              .filter((data) =>
                typeof data === "string" ? data.length > 0 : true,
              )
              .join(" | ")}
          </div>
        )}
        {props.mother && (
          <div>
            <b>אם: </b>
            {Object.values(props.mother)
              .filter((data) =>
                typeof data === "string" ? data.length > 0 : true,
              )
              .join(" | ")}
          </div>
        )}
      </div>

      {/* כפתור הוספה אם מדובר בפייבוריט */}
      {favorites && (
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={() => props.onAddToDesk?.(props.item!)}
        >
          הוספת כרטיס לשידוך
          <CirclePlus />
        </Button>
      )}

      {/* כפתורים כלליים */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" asChild>
          <Link href={`/app/students/${props.item?.id}`}>
            צפיה בקו״ח
            <FileCheck />
          </Link>
        </Button>
        {props.draggable ? (
          <Button
            variant="destructiveOutline"
            onClick={() => props.onRemoveFromFavorites?.(props.item!)}
          >
            הסרה מהמועדפים
            <X />
          </Button>
        ) : (
          <Button variant="destructiveOutline" onClick={props.onRemoveFromDesk}>
            הסרה מהשידוך
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}

export default StudentBox;
