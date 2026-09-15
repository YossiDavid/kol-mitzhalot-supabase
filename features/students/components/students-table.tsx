"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Camera, FileText, Star } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import DeleteStudentButton from "@/features/students/components/delete-student-button";
import { personalStatusToHebrew } from "@/features/students/lib/profile-labels";
import {
  isOutOfShidduchimStatus,
  isRecentlyEngaged,
} from "@/features/students/lib/student-status";
import calculateAge from "@/lib/calculateAge";
import { cn } from "@/lib/utils";

type ParentName = { prefix?: string; name?: string; suffix?: string };

/** השדות שטבלת המיועדים מציגה - משותף לרשימה, למועדפים ולילדים */
export type StudentTableRow = {
  id: string;
  gender?: "male" | "female";
  personal_status: string;
  first_name: string;
  last_name: string;
  parents_info?: {
    father?: { self?: ParentName };
    mother?: { self?: ParentName };
  } | null;
  city?: string | null;
  birth_date?: string | Date | null;
  height?: number | null;
  cv_url?: string | null;
  /** מספר התמונות בגלריה - התמונות עצמן אינן נשלפות לרשימה */
  photo_count?: number | null;
  status_changed_at?: string | null;
  in_shidduchim?: boolean | null;
};

/** רשימת המיועדים: כוכב מועדפים, ומחיקה למנהל */
type ListPreset = {
  preset: "list";
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string, nextIsFavorite: boolean) => void;
  canDelete: boolean;
  onDeleted: (id: string) => void;
};

/** המועדפים בלוח הבקרה: הכוכב מסיר מהמועדפים */
type FavoritesPreset = {
  preset: "favorites";
  onRemoveFavorite: (id: string) => void;
};

/** הילדים של ההורה: מתג "פעיל בשידוכים", והדגשת קו״ח חסר */
type ChildrenPreset = {
  preset: "children";
  onInShidduchimChange: (id: string, checked: boolean) => void;
};

export type StudentsTablePreset = (
  | ListPreset
  | FavoritesPreset
  | ChildrenPreset
)["preset"];

type StudentsTableProps = {
  students: readonly StudentTableRow[];
  /** תיאור הטבלה לקוראי מסך */
  caption: string;
  emptyState?: ReactNode;
  className?: string;
} & (ListPreset | FavoritesPreset | ChildrenPreset);

const ENGAGED_ROW_CLASS = "bg-warning-muted hover:bg-warning/30";

const MISSING_CV_CLASS =
  "border-warning bg-warning-muted text-warning-muted-foreground hover:bg-warning/30";

/** אין עדיין מסך להוספת קו״ח מהרשימה - הקישור נשמר כפי שהיה */
const ADD_CV_HREF = "/" as Route;

function fullName(student: StudentTableRow) {
  return `${student.first_name} ${student.last_name}`;
}

function studentCardHref(id: string) {
  return `/app/students/${id}` as Route;
}

function parentName(parent: ParentName | undefined) {
  return [parent?.prefix, parent?.name].filter(Boolean).join(" ");
}

function StarToggle({
  isActive,
  isDisabled = false,
  label,
  onToggle,
}: {
  isActive: boolean;
  isDisabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="p-1 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={isDisabled}
      aria-label={label}
    >
      <Star
        className={cn(
          "size-5 transition-colors",
          isActive ? "fill-favorite text-favorite" : "text-muted-foreground",
        )}
      />
    </button>
  );
}

function StatusCell({ student }: { student: StudentTableRow }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {personalStatusToHebrew(student.personal_status, student.gender)}
      {(student.photo_count ?? 0) > 0 && (
        <Camera
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-label="יש תמונה"
        />
      )}
      {student.cv_url && (
        <FileText
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-label="יש קובץ קו״ח"
        />
      )}
    </span>
  );
}

function MobileTitle({ student }: { student: StudentTableRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5">
      {fullName(student)}
      {isRecentlyEngaged(student) && (
        <span className="text-caption font-medium text-warning-muted-foreground">
          🎉 מאורס/ת
        </span>
      )}
    </span>
  );
}

function ActionsCell({
  student,
  highlightMissingCv,
}: {
  student: StudentTableRow;
  highlightMissingCv: boolean;
}) {
  return (
    <div className="flex w-full gap-2">
      {student.cv_url ? (
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={student.cv_url} target="_blank" rel="noopener noreferrer">
            קובץ קו״ח
          </a>
        </Button>
      ) : (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn("flex-1", highlightMissingCv && MISSING_CV_CLASS)}
        >
          <Link href={ADD_CV_HREF}>הוספת קו״ח</Link>
        </Button>
      )}
      <Button asChild size="sm" className="flex-1">
        <Link href={studentCardHref(student.id)}>כרטיס מלא</Link>
      </Button>
    </div>
  );
}

function leadingColumn(
  props: StudentsTableProps,
): DataTableColumn<StudentTableRow> {
  if (props.preset === "children") {
    return {
      key: "in-shidduchim",
      header: "בשידוכים",
      mobileLabel: "פעיל בשידוכים",
      size: "min",
      cell: (student) => (
        <Switch
          checked={student.in_shidduchim ?? false}
          onCheckedChange={(checked) =>
            props.onInShidduchimChange(student.id, checked)
          }
          aria-label={`פעיל בשידוכים: ${fullName(student)}`}
        />
      ),
    };
  }

  if (props.preset === "favorites") {
    return {
      key: "favorite",
      header: "מועדף",
      size: "min",
      mobile: "aside",
      cell: (student) => (
        <StarToggle
          isActive
          label={`הסר ממועדפים: ${fullName(student)}`}
          onToggle={() => props.onRemoveFavorite(student.id)}
        />
      ),
    };
  }

  return {
    key: "favorite",
    header: "מועדף",
    size: "min",
    mobile: "aside",
    cell: (student) => {
      const isFavorite = props.isFavorite(student.id);
      const isBlocked =
        !isFavorite && isOutOfShidduchimStatus(student.personal_status);
      return (
        <div className="flex items-center gap-1">
          <StarToggle
            isActive={isFavorite}
            isDisabled={isBlocked}
            label={
              isFavorite
                ? "הסר ממועדפים"
                : isBlocked
                  ? "לא ניתן להוסיף מאורס או נשוי למועדפים"
                  : "הוסף למועדפים"
            }
            onToggle={() => props.onToggleFavorite(student.id, !isFavorite)}
          />
          {props.canDelete && (
            <DeleteStudentButton
              variant="icon"
              studentId={student.id}
              studentName={fullName(student)}
              onDeleted={() => props.onDeleted(student.id)}
            />
          )}
        </div>
      );
    },
  };
}

function buildColumns(
  props: StudentsTableProps,
): DataTableColumn<StudentTableRow>[] {
  return [
    leadingColumn(props),
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      cell: (student) => <StatusCell student={student} />,
    },
    {
      key: "last-name",
      header: "שם משפחה",
      mobile: "hidden",
      cell: (student) => student.last_name,
    },
    {
      key: "first-name",
      header: "שם פרטי",
      mobile: "hidden",
      cell: (student) => student.first_name,
    },
    {
      key: "father",
      header: "שם האב",
      mobile: "hidden",
      cell: (student) => parentName(student.parents_info?.father?.self),
    },
    {
      key: "mother",
      header: "שם האם",
      mobile: "hidden",
      cell: (student) => parentName(student.parents_info?.mother?.self),
    },
    {
      key: "city",
      header: "עיר",
      cell: (student) => student.city,
    },
    {
      key: "age",
      header: "גיל",
      size: "min",
      cell: (student) => calculateAge(student.birth_date || ""),
    },
    {
      key: "height",
      header: "גובה",
      size: "min",
      cell: (student) => student.height,
    },
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      mobile: "actions",
      cell: (student) => (
        <ActionsCell
          student={student}
          highlightMissingCv={props.preset === "children"}
        />
      ),
    },
  ];
}

/**
 * טבלת המיועדים אחת לרשימה, למועדפים ולילדים. כל שורה פותחת את הכרטיס
 * המלא; העמודה הראשונה ורמת ההדגשה משתנות לפי ההקשר (preset).
 */
export function StudentsTable(props: StudentsTableProps) {
  const { students, caption, emptyState, className } = props;
  return (
    <DataTable
      className={className}
      caption={caption}
      breakpoint="lg"
      columns={buildColumns(props)}
      rows={students}
      getRowKey={(student) => student.id}
      getRowLink={(student) => ({
        href: studentCardHref(student.id),
        label: `כרטיס מלא: ${fullName(student)}`,
      })}
      rowClassName={(student) =>
        isRecentlyEngaged(student) && ENGAGED_ROW_CLASS
      }
      mobileTitle={(student) => <MobileTitle student={student} />}
      emptyState={emptyState}
    />
  );
}
