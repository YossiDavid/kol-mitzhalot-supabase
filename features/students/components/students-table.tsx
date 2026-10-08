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
import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";
import { useStudentThumbnails } from "@/features/students/lib/use-student-thumbnails";
import {
  formatFirstNameWithNickname,
  personalStatusToHebrew,
} from "@/features/students/lib/profile-labels";
import {
  isOutOfShidduchimStatus,
  isRecentlyEngaged,
} from "@/features/students/lib/student-status";
import { NewCardBadge } from "@/features/students/components/new-card-badge";
import { SelfCardTag } from "@/features/students/components/self-card-tag";
import { ThirdPartyCardTag } from "@/features/students/components/third-party-card-tag";
import type { CardFor } from "@/features/students/lib/own-cards-heading";
import { summarizeChildren } from "@/features/students/lib/children-summary";
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
  /** כינוי, מוצג בסוגריים אחרי השם הפרטי. שדה לא חובה בטופס */
  nickname?: string | null;
  parents_info?: {
    father?: { self?: ParentName };
    mother?: { self?: ParentName };
  } | null;
  city?: string | null;
  /** חסידות או קהילה, מתוך מאגר הקהילות */
  community?: string | null;
  birth_date?: string | Date | null;
  height?: number | null;
  cv_url?: string | null;
  /** מספר התמונות בגלריה - התמונות עצמן אינן נשלפות לרשימה */
  photo_count?: number | null;
  status_changed_at?: string | null;
  /** מתי נוצר הכרטיס - לתג "חדש" ולעמודת "נוסף" ברשימה */
  created_at?: string | null;
  /** עבור מי מולא הכרטיס. null בכרטיסים ישנים */
  card_for?: CardFor;
  /** אישורי הנהלה לכרטיס צד שלישי (null = טרם אושר) */
  third_party_full_display_approved_at?: string | null;
  third_party_proposals_approved_at?: string | null;
  in_shidduchim?: boolean | null;
  /** הנהלת המערכת השהתה את הכרטיס - מנהל הכרטיס אינו יכול לבטל */
  admin_paused_at?: string | null;
  /** מכסת הצעות שקבע מנהל הכרטיס (null = ללא הגבלה) */
  proposal_limit_count?: number | null;
  proposal_limit_period?: string | null;
  /** נישואים קודמים (children, children_number, no_children) - רק ברשימה */
  previous_partners?: unknown;
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
  /** תא "הגבלת הצעות" - נמסר מהקורא כי הוא יודע לשמור ולעדכן את השורה */
  renderProposalLimit: (student: StudentTableRow) => ReactNode;
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
  /**
   * השורות כבר ממוינות בשרת (הרשימה הראשית): הטבלה מציגה את פקדי המיון
   * בלי למיין מחדש. ברירת מחדל: מיון בלקוח, כמו ברשימות הקטנות.
   */
  isSortedExternally?: boolean;
} & (ListPreset | FavoritesPreset | ChildrenPreset);

/** --row-tint: הגוון שהעמודה הדבוקה (isStickyEnd) משכבת מעל רקע אטום */
const ENGAGED_ROW_CLASS =
  "bg-warning-muted [--row-tint:var(--warning-muted)] hover:bg-warning/30 hover:[--row-tint:color-mix(in_oklab,var(--warning)_30%,transparent)]";

const MISSING_CV_CLASS =
  "border-warning bg-warning-muted text-warning-muted-foreground hover:bg-warning/30";

function fullName(student: StudentTableRow) {
  return `${student.first_name} ${student.last_name}`;
}

/** השם הפרטי עם הכינוי, באותו ניסוח של הכרטיס. המיון נשאר לפי השם בלבד */
function firstNameWithNickname(student: StudentTableRow) {
  return formatFirstNameWithNickname(student.first_name, student.nickname);
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

/** שם האב והאם בשתי שורות קצרות; ז״ל וכו׳ נשארים כחלק מהתואר */
function ParentsCell({ student }: { student: StudentTableRow }) {
  const father = parentName(student.parents_info?.father?.self);
  const mother = parentName(student.parents_info?.mother?.self);
  if (!father && !mother) return null;
  return (
    <span className="flex flex-col leading-snug">
      {father && <span>{father}</span>}
      {mother && <span>{mother}</span>}
    </span>
  );
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
  const childrenSummary = summarizeChildren(
    student.personal_status,
    student.previous_partners,
  );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {personalStatusToHebrew(student.personal_status, student.gender)}
      {childrenSummary && (
        <span
          className="text-caption text-muted-foreground"
          data-testid="children-summary"
        >
          · {childrenSummary}
        </span>
      )}
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

/**
 * תגיות ליד השם: "חדש" ברשימה, "הכרטיס שלי" בכרטיסים של המשתמש עצמו, ובכל
 * הטבלאות - "מולא ע״י צד שלישי" כשהכרטיס כזה
 */
function NameBadges({
  student,
  preset,
  now,
}: {
  student: StudentTableRow;
  preset: StudentsTablePreset;
  now: Date;
}) {
  return (
    <>
      {preset === "list" && (
        <NewCardBadge createdAt={student.created_at} now={now} />
      )}
      {preset === "children" && <SelfCardTag cardFor={student.card_for} />}
      <ThirdPartyCardTag card={student} />
    </>
  );
}

/** תאריך ההוספה לתצוגה, לפי יום ישראלי */
function formatAddedDate(createdAt: string | null | undefined) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", { timeZone: ISRAEL_TIME_ZONE });
}

function MobileTitle({
  student,
  photo,
  preset,
  now,
}: {
  student: StudentTableRow;
  photo: ReactNode;
  preset: StudentsTablePreset;
  now: Date;
}) {
  return (
    <span className="flex items-center gap-3">
      {photo}
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        {/* בנייד אין עמודות, ולכן הכינוי מופיע כאן - כמו בעמודת השם בדסקטופ */}
        {`${firstNameWithNickname(student)} ${student.last_name}`}
        {isRecentlyEngaged(student) && (
          <span className="text-caption font-medium text-warning-muted-foreground">
            🎉 מאורס/ת
          </span>
        )}
        <NameBadges student={student} preset={preset} now={now} />
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
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={student.in_shidduchim ?? false}
              // השהיית הנהלה: הנעילה נאכפת גם במסד, וכאן רק מונעים את הלחיצה
              disabled={!!student.admin_paused_at}
              onCheckedChange={(checked) =>
                props.onInShidduchimChange(student.id, checked)
              }
              aria-label={`פעיל בשידוכים: ${fullName(student)}`}
            />
            {/* המצב גם בטקסט, באותו ניסוח של באנר הכרטיס ("אינו/ה בשידוכים") */}
            <span className="text-body-sm text-muted-foreground">
              {student.in_shidduchim ? "בשידוכים" : "לא בשידוכים"}
            </span>
          </div>
          {student.admin_paused_at && (
            <span
              className="max-w-40 text-caption text-muted-foreground"
              data-testid="admin-paused-note"
            >
              הכרטיס הושהה על ידי הנהלת המערכת
            </span>
          )}
        </div>
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

/** עמודת "הגבלת הצעות" - רק בטבלת הילדים של ההורה */
function proposalLimitColumns(
  props: StudentsTableProps,
): DataTableColumn<StudentTableRow>[] {
  if (props.preset !== "children") return [];
  const { renderProposalLimit } = props;
  return [
    {
      key: "proposal-limit",
      header: "הגבלת הצעות",
      size: "min",
      mobileLabel: "הגבלת הצעות",
      cell: (student) => renderProposalLimit(student),
    },
  ];
}

/** עמודת "נוסף" (תאריך הוספה, ממוינת בשרת) - ברשימה בלבד */
function addedColumns(
  props: StudentsTableProps,
): DataTableColumn<StudentTableRow>[] {
  if (props.preset !== "list") return [];
  return [
    {
      key: "created",
      header: "נוסף",
      size: "min",
      mobile: "hidden",
      cell: (student) => formatAddedDate(student.created_at),
      sortValue: (student) =>
        student.created_at ? new Date(student.created_at) : null,
    },
  ];
}

function buildColumns(
  props: StudentsTableProps,
  renderPhoto: RenderPhoto,
  now: Date,
): DataTableColumn<StudentTableRow>[] {
  return [
    leadingColumn(props),
    ...proposalLimitColumns(props),
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
      cell: (student) => (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {firstNameWithNickname(student)}
          <NameBadges student={student} preset={props.preset} now={now} />
        </span>
      ),
      // המיון לפי השם עצמו: כינוי לא אמור לפזר שמות זהים ברשימה
      sortValue: (student) => student.first_name,
    },
    {
      key: "parents",
      header: "הורים",
      mobile: "hidden",
      cell: (student) => <ParentsCell student={student} />,
    },
    {
      key: "city",
      header: "עיר",
      cell: (student) => student.city,
      sortValue: (student) => student.city,
    },
    {
      key: "community",
      header: "חסידות",
      cell: (student) => student.community,
      sortValue: (student) => student.community,
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
    ...addedColumns(props),
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      isStickyEnd: true,
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
  const {
    students,
    caption,
    emptyState,
    className,
    sort,
    onSortChange,
    isSortedExternally,
  } = props;
  // רק לכרטיסים שיש להם תמונות - שאר השורות מוצגות מיד בלי בקשה
  const idsWithPhotos = useMemo(
    () =>
      students
        .filter((student) => (student.photo_count ?? 0) > 0)
        .map((student) => student.id),
    [students],
  );
  const getPhotoState = useStudentThumbnails(idsWithPhotos);
  // רגע אחד לכל השורות: התג נקבע מחדש עם כל טעינה של שורות חדשות
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [students]);
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
      columns={buildColumns(props, renderPhoto, now)}
      rows={students}
      sort={sort}
      onSortChange={onSortChange}
      isSortedExternally={isSortedExternally}
      getRowKey={(student) => student.id}
      getRowLink={(student) => ({
        href: studentCardHref(student.id),
        label: `כרטיס מלא: ${fullName(student)}`,
      })}
      rowClassName={(student) =>
        isRecentlyEngaged(student) && ENGAGED_ROW_CLASS
      }
      mobileTitle={(student) => (
        <MobileTitle
          student={student}
          photo={renderPhoto(student)}
          preset={props.preset}
          now={now}
        />
      )}
      emptyState={emptyState}
    />
  );
}
