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
    father?: { self?: { name?: string; suffix?: string }; job?: string };
    mother?: {
      self?: { name?: string; suffix?: string };
      job?: string;
      maidenName?: string;
    };
  };
  employment_history?: Array<{ category: string }>;
};

type StudentBoxContextValue = { item?: Student };

const StudentBoxContext = React.createContext<StudentBoxContextValue>({});

type StudentBoxProps = React.HTMLAttributes<HTMLDivElement> & {
  gender: "male" | "female";
  firstName?: string;
  lastName?: string;
  age?: number;
  city?: string;
  doingToday?: string[];
  father?: { name: string; position: string };
  mother?: { name: string; maidenName?: string; position: string };
  item?: Student;
  draggable?: boolean;
  setDraggingGender?: (gender: "male" | "female" | null) => void;
  /** שיבוץ בלי גרירה: לחיצה כפולה, או Enter/רווח כשהכרטיס עצמו בפוקוס */
  onActivate?: (student: Student) => void;
};

/** לחיצה כפולה על כפתור/קישור בתוך הכרטיס היא של הפקד, לא שיבוץ. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button, a") !== null;
}

function StudentBox({
  className,
  gender,
  firstName,
  lastName,
  age,
  city,
  doingToday,
  father,
  mother,
  item,
  draggable,
  setDraggingGender,
  onActivate,
  children,
  ...divProps
}: StudentBoxProps) {
  const subtitleParts = [
    age != null ? `${age}` : null,
    city || null,
    doingToday?.filter(Boolean).join(", ") || null,
  ].filter(Boolean);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    divProps.onDragStart?.(e);
    if (!draggable) return;
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ ...(item ?? {}), gender }),
    );
    setDraggingGender?.(gender);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    divProps.onDragEnd?.(e);
    setDraggingGender?.(null);
  };

  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    divProps.onDoubleClick?.(e);
    if (!onActivate || !item || isInteractiveTarget(e.target)) return;
    onActivate(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    divProps.onKeyDown?.(e);
    // רק כשהפוקוס על הכרטיס עצמו - Enter על כפתור פנימי שייך לכפתור
    if (!onActivate || !item || e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onActivate(item);
  };

  return (
    <StudentBoxContext.Provider value={{ item }}>
      <div
        {...divProps}
        {...(onActivate && {
          role: "group",
          tabIndex: 0,
          "aria-label": `${fullName}. לחיצה כפולה או Enter לשיבוץ בלוח`,
          onDoubleClick: handleDoubleClick,
          onKeyDown: handleKeyDown,
        })}
        className={cn(
          "rounded-md bg-white p-4",
          draggable && "cursor-grab active:cursor-grabbing",
          onActivate &&
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="font-semibold">
          {`${firstName ?? ""} ${lastName ?? ""}`.trim()}
        </div>

        {subtitleParts.length > 0 && (
          <div className="mt-0.5 text-body-sm text-muted-foreground">
            {subtitleParts.join(" | ")}
          </div>
        )}

        <div className="mt-3 rounded-lg bg-muted p-2 text-body-sm">
          {father && (
            <div>
              <b>אב: </b>
              {Object.values(father)
                .filter((v) => typeof v === "string" && v.length > 0)
                .join(" | ")}
            </div>
          )}
          {mother && (
            <div>
              <b>אם: </b>
              {Object.values(mother)
                .filter((v) => typeof v === "string" && v.length > 0)
                .join(" | ")}
            </div>
          )}
        </div>

        {children && <div className="mt-4 space-y-2">{children}</div>}
      </div>
    </StudentBoxContext.Provider>
  );
}

StudentBox.AddToDesk = function AddToDesk({
  onClick,
}: {
  onClick: (student: Student) => void;
}) {
  const { item } = React.useContext(StudentBoxContext);
  const fullName = `${item?.first_name ?? ""} ${item?.last_name ?? ""}`.trim();
  const slotLabel = item?.gender === "female" ? "המיועדת" : "המיועד";
  return (
    <Button
      className="w-full"
      onClick={() => item && onClick(item)}
      aria-label={`שיבוץ ${fullName} במשבצת ${slotLabel}`}
    >
      שיבוץ
      <CirclePlus className="size-4" />
    </Button>
  );
};

StudentBox.ViewProfile = function ViewProfile() {
  const { item } = React.useContext(StudentBoxContext);
  return (
    <Button variant="outline" className="w-full" asChild>
      <Link href={`/app/students/${item?.id}`}>
        צפיה בקו״ח
        <FileCheck className="size-4" />
      </Link>
    </Button>
  );
};

StudentBox.RemoveFromFavorites = function RemoveFromFavorites({
  onClick,
}: {
  onClick: (student: Student) => void;
}) {
  const { item } = React.useContext(StudentBoxContext);
  return (
    <Button
      variant="destructiveOutline"
      className="w-full"
      onClick={() => item && onClick(item)}
    >
      הסרה מהמועדפים
      <X className="size-4" />
    </Button>
  );
};

StudentBox.RemoveFromDesk = function RemoveFromDesk({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button variant="destructiveOutline" className="w-full" onClick={onClick}>
      הסרה מהשידוך
      <X className="size-4" />
    </Button>
  );
};

export default StudentBox;
export type { Student };
