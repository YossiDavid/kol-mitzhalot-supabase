"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Camera, FileText, Star } from "lucide-react";

import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AddCvDialog } from "@/features/students/components/add-cv-dialog";
import DeleteStudentButton from "@/features/students/components/delete-student-button";
import { StudentRowPhoto } from "@/features/students/components/student-row-photo";
import { useStudentThumbnails } from "@/features/students/lib/use-student-thumbnails";
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
  /** אחרי הוספת קו״ח מהדיאלוג - לעדכון השורה בלי לטעון מחדש */
  onCvAdded: (id: string, cvUrl: string) => void;
  emptyState?: ReactNode;
  className?: string;
  /** מיון נשלט, כשהוא צריך לשרוד טעינה מחדש (הרשימה). אחרת - פנימי */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
} & (ListPreset | FavoritesPreset | ChildrenPreset);

const ENGAGED_ROW_CLASS = "bg-warning-muted hover:bg-warning/30";

const MISSING_CV_CLASS =
  "border-warning bg-warning-muted text-warning-muted-foreground hover:bg-warning/30";

function fullName(student: StudentTableRow) {
  return `${student.first_name} ${student.last_name}`;
}

function studentCardHref(id: string) {
  return `/app/students/${id}` as Route;
}

function parentName(parent: ParentName | undefined) {
  return [parent?.prefix, parent?.name].filter(Boolean).join(" ");
}

/**
 * ערך מיון לעמודת הגיל: ככל שתאריך הלידה מוקדם יותר הגיל גבוה יותר, ולכן
 * "סדר עולה" (מהצעיר למבוגר) הוא תאריך לידה בסדר יורד.
 */
function ageSortValue(student: StudentTableRow): number | null {
  if (!student.birth_date) return null;
  const time = new Date(student.birth_date).getTime();
  return Number.isNaN(time) ? null : -time;
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

function MobileTitle({
  student,
  photo,
}: {
  student: StudentTableRow;
  photo: ReactNode;
}) {
  return (
    <span className="flex items-center gap-3">
      {photo}
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        {fullName(student)}
        {isRecentlyEngaged(student) && (
          <span className="text-caption font-medium text-warning-muted-foreground">
            🎉 מאורס/ת
          </span>
        )}
      </span>
    </span>
  );
}

type RenderPhoto = (student: StudentTableRow) => ReactNode;

function ActionsCell({
  student,
  highlightMissingCv,
  onCvAdded,
}: {
  student: StudentTableRow;
  highlightMissingCv: boolean;
  onCvAdded: (id: string, cvUrl: string) => void;
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
        <AddCvDialog
          studentId={student.id}
          studentName={fullName(student)}
          onCvAdded={(cvUrl) => onCvAdded(student.id, cvUrl)}
          triggerClassName={cn(
            "flex-1",
            highlightMissingCv && MISSING_CV_CLASS,
          )}
        />
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
  renderPhoto: RenderPhoto,
): DataTableColumn<StudentTableRow>[] {
  return [
    leadingColumn(props),
    {
      key: "photo",
      header: "תמונה",
      size: "min",
      // במובייל התמונה מוצגת לצד השם בכותרת הכרטיס
      mobile: "hidden",
      cell: renderPhoto,
    },
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      cell: (student) => <StatusCell student={student} />,
      sortValue: (student) =>
        personalStatusToHebrew(student.personal_status, student.gender),
    },
    {
      key: "last-name",
      header: "שם משפחה",
      mobile: "hidden",
      cell: (student) => student.last_name,
      sortValue: (student) => student.last_name,
    },
    {
      key: "first-name",
      header: "שם פרטי",
      mobile: "hidden",
      cell: (student) => student.first_name,
      sortValue: (student) => student.first_name,
    },
    {
      key: "father",
      header: "שם האב",
      mobile: "hidden",
      cell: (student) => parentName(student.parents_info?.father?.self),
      sortValue: (student) => student.parents_info?.father?.self?.name,
    },
    {
      key: "mother",
      header: "שם האם",
      mobile: "hidden",
      cell: (student) => parentName(student.parents_info?.mother?.self),
      sortValue: (student) => student.parents_info?.mother?.self?.name,
    },
    {
      key: "city",
      header: "עיר",
      cell: (student) => student.city,
      sortValue: (student) => student.city,
    },
    {
      key: "age",
      header: "גיל",
      size: "min",
      cell: (student) => calculateAge(student.birth_date || ""),
      sortValue: ageSortValue,
    },
    {
      key: "height",
      header: "גובה",
      size: "min",
      cell: (student) => student.height,
      sortValue: (student) => student.height,
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
          onCvAdded={props.onCvAdded}
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
  const { students, caption, emptyState, className, sort, onSortChange } =
    props;
  // רק לכרטיסים שיש להם תמונות - שאר השורות מוצגות מיד בלי בקשה
  const idsWithPhotos = useMemo(
    () =>
      students
        .filter((student) => (student.photo_count ?? 0) > 0)
        .map((student) => student.id),
    [students],
  );
  const getPhotoState = useStudentThumbnails(idsWithPhotos);
  const renderPhoto: RenderPhoto = (student) => (
    <StudentRowPhoto
      studentId={student.id}
      studentName={fullName(student)}
      photoCount={student.photo_count ?? 0}
      state={getPhotoState(student.id)}
    />
  );

  return (
    <DataTable
      className={className}
      caption={caption}
      breakpoint="lg"
      columns={buildColumns(props, renderPhoto)}
      rows={students}
      sort={sort}
      onSortChange={onSortChange}
      getRowKey={(student) => student.id}
      getRowLink={(student) => ({
        href: studentCardHref(student.id),
        label: `כרטיס מלא: ${fullName(student)}`,
      })}
      rowClassName={(student) =>
        isRecentlyEngaged(student) && ENGAGED_ROW_CLASS
      }
      mobileTitle={(student) => (
        <MobileTitle student={student} photo={renderPhoto(student)} />
      )}
      emptyState={emptyState}
    />
  );
}
