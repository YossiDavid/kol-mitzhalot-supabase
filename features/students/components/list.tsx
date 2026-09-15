"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudentQuery } from "@/features/students/lib/student-query-context";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";
import DeleteStudentButton from "@/features/students/components/delete-student-button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import calculateAge from "@/lib/calculateAge";
import { Star, Camera, FileText } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useRowLink } from "@/features/students/lib/use-row-link";

type Student = {
  id: string;
  gender: "male" | "female";
  personal_status: "married" | "engaged" | "single";
  last_name: string;
  first_name: string;
  parents_info: {
    father: {
      self: {
        prefix: string;
        name: string;
        suffix: string;
      };
    };
    mother: {
      self: {
        prefix: string;
        name: string;
        suffix: string;
      };
    };
  };
  city: string;
  birth_date: Date;
  height: number;
  cv_url?: string;
  /** מספר התמונות בגלריה - התמונות עצמן אינן נשלפות לרשימה */
  photo_count?: number;
  status_changed_at?: string | null;
  permalink: string;
};

/**
 * כל השורה/הכרטיס הם קישור לכרטיס המלא. Box מעביר רק className ומשמיט
 * אירועים ו-props אחרים, ולכן משתמשים ב-div עם המחלקה box עצמה.
 */
const CLICKABLE_ROW_CLASS =
  "box cursor-pointer p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

const ENGAGED_ROW_CLASS = "border-warning bg-warning-muted hover:bg-warning/30";

/**
 * סטטוסים שמוציאים את הכרטיס משידוכים (in_shidduchim=false). ברשימה
 * הרגילה הם מוסתרים, אבל סינון מפורש לפיהם מציג אותם - אחרת כרטיס שסומן
 * "נשוי" בטעות נעלם ואין דרך להגיע אליו כדי להחזיר את הסטטוס.
 */
const OUT_OF_SHIDDUCHIM_STATUSES: readonly string[] = ["engaged", "married"];

function isOutOfShidduchimStatus(status: string | undefined): boolean {
  return !!status && OUT_OF_SHIDDUCHIM_STATUSES.includes(status);
}

/** מנקה תווים שיש להם משמעות בתחביר הסינון של PostgREST */
function sanitizeTerm(value: string | undefined): string {
  return (value ?? "").trim().replace(/[%,()]/g, "");
}

/** מספר שלם אי-שלילי מתוך שדה טקסט, או null כשהשדה ריק/לא תקין */
function parseNonNegativeInt(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
}

/** התאריך (YYYY-MM-DD) של היום לפני `years` שנים */
function yearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().split("T")[0];
}

function studentCardHref(id: string) {
  return `/app/students/${id}` as const;
}

function isRecentlyEngaged(student: Student): boolean {
  if (student.personal_status !== "engaged") return false;
  if (!student.status_changed_at) return true;
  const changedAt = new Date(student.status_changed_at);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return changedAt >= oneMonthAgo;
}

function parseStatus(status: string, gender?: string): string {
  const f = gender === "female";
  if (status === "married") return f ? "נשואה" : "נשוי";
  if (status === "engaged") return f ? "מאורסת" : "מאורס";
  if (status === "single") return f ? "רווקה" : "רווק";
  if (status === "divorced") return f ? "גרושה" : "גרוש";
  if (status === "widowed") return f ? "אלמנה" : "אלמן";
  return status;
}

export default function StudentsList() {
  const [user, setUser] = useState<User | undefined>(undefined);
  const { query } = useStudentQuery();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  // שגיאת טעינה אמיתית — נבדלת מ"אין תוצאות", כדי שכשל שאילתה לא ייראה כמו חיפוש ריק
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted) setUser(user || undefined);
    });
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    async function fetchStudents() {
      setLoading(true);
      setLoadError(null);
      try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneMonthAgoStr = oneMonthAgo.toISOString();

        // סינון לפי טבלה קשורה דורש join פנימי (!inner) - אחרת השורה חוזרת
        // גם כשאין לה עיסוק/מוסד תואם, רק עם מערך קשור ריק
        const institution = sanitizeTerm(query.institution);
        const selectColumns = [
          "*",
          ...(query.employment ? ["employment_history!inner(category)"] : []),
          ...(institution ? ["education_history!inner(name)"] : []),
        ].join(",");

        let q = supabase
          .from("students")
          .select(selectColumns)
          .is("deleted_at", null);

        // Active cards, or recently engaged (status_changed_at may be null on older rows).
        // An explicit engaged/married filter skips this, so those cards stay reachable.
        if (!isOutOfShidduchimStatus(query.personal_status)) {
          q = q.or(
            [
              "in_shidduchim.eq.true",
              "in_shidduchim.is.null",
              `and(personal_status.eq.engaged,status_changed_at.gte.${oneMonthAgoStr})`,
              "and(personal_status.eq.engaged,status_changed_at.is.null)",
            ].join(","),
          );
        }

        // חיפוש חופשי על פני העמודות שמשתמש היה מצפה להקליד בהן.
        // ilike ולא textSearch, כי אין אינדקס full-text והשמות קצרים.
        {
          const term = sanitizeTerm(query.search);
          if (term) {
            q = q.or(
              [
                `first_name.ilike.%${term}%`,
                `last_name.ilike.%${term}%`,
                `city.ilike.%${term}%`,
                `community.ilike.%${term}%`,
                `shtible.ilike.%${term}%`,
              ].join(","),
            );
          }
        }

        if (query.first_name)
          q = q.ilike("first_name", `%${query.first_name}%`);
        if (query.last_name) q = q.ilike("last_name", `%${query.last_name}%`);
        if (query.gender) q = q.eq("gender", query.gender);
        if (query.personal_status)
          q = q.eq("personal_status", query.personal_status);
        if (query.city) q = q.ilike("city", `%${query.city}%`);

        const fatherName = sanitizeTerm(query.father_name);
        if (fatherName) {
          q = q.ilike("parents_info->father->self->>name", `%${fatherName}%`);
        }
        if (query.employment) {
          q = q.eq("employment_history.category", query.employment);
        }
        if (institution) {
          q = q.ilike("education_history.name", `%${institution}%`);
        }

        // גיל X ומעלה: נולד עד לפני X שנים. גיל Y לכל היותר: נולד אחרי
        // לפני Y+1 שנים (מי שבן Y ו-11 חודשים עדיין "בן Y").
        const ageMin = parseNonNegativeInt(query.ageMin);
        if (ageMin !== null) q = q.lte("birth_date", yearsAgo(ageMin));
        const ageMax = parseNonNegativeInt(query.ageMax);
        if (ageMax !== null) q = q.gt("birth_date", yearsAgo(ageMax + 1));

        const heightMin = parseNonNegativeInt(query.heightMin);
        if (heightMin !== null) q = q.gte("height", heightMin);
        const heightMax = parseNonNegativeInt(query.heightMax);
        if (heightMax !== null) q = q.lte("height", heightMax);

        if (query.is_yeshiva === "true" || query.is_yeshiva === "false") {
          q = q.eq("is_yeshiva", query.is_yeshiva === "true");
        }

        const { data, error } = await q;
        if (!isMounted) return;
        if (error) {
          console.error("[students/list] query failed:", error);
          toast.error("לא הצלחנו לטעון את רשימת הכרטיסים");
          setStudents([]);
          setLoadError(error.message);
          return;
        }
        // select דינמי (עם join לפי הסינון) מבלבל את הסקת הטיפוסים של supabase-js
        setStudents((data ?? []) as unknown as Student[]);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "שגיאה לא צפויה";
        console.error("[students/list] unexpected failure:", err);
        toast.error("לא הצלחנו לטעון את רשימת הכרטיסים");
        setStudents([]);
        setLoadError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStudents();
    return () => {
      isMounted = false;
    };
  }, [query, supabase, reloadKey]);

  const favSet = useMemo(
    () => new Set<string>(user?.user_metadata?.favorites || []),
    [user?.user_metadata?.favorites],
  );

  const isAdmin = hasRole(user, "admin");
  const getRowLinkProps = useRowLink();
  const rowLinkPropsFor = (student: Student) =>
    getRowLinkProps(
      studentCardHref(student.id),
      `כרטיס מלא: ${student.first_name} ${student.last_name}`,
    );

  const handleStudentDeleted = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  /** מאורס או נשוי אינם רלוונטיים לשידוך, ולכן לא ניתן להוסיפם למועדפים. */
  const isOutOfShidduchim = (id: string) =>
    isOutOfShidduchimStatus(students.find((s) => s.id === id)?.personal_status);

  const handleFavoriteChange = async (checked: boolean, id: string) => {
    // חוסמים הוספה בלבד. הסרה נשארת פתוחה, כדי שמי שכבר במועדפים
    // והתארס מאז יוכל לצאת משם.
    if (checked && isOutOfShidduchim(id)) {
      toast.info("לא ניתן להוסיף מאורס או נשוי למועדפים");
      return;
    }

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
    if (data) setUser(data.user || undefined);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-center">
        <Spinner /> טוען נתונים...
      </div>
    );

  // כשל בטעינה אינו "אין תוצאות" — מציגים אותו במפורש עם אפשרות לנסות שוב
  if (loadError)
    return (
      <div className="mt-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>לא הצלחנו לטעון את רשימת הכרטיסים</EmptyTitle>
            <EmptyDescription>
              אירעה תקלה בשליפת הנתונים. נסו שוב, ואם התקלה חוזרת פנו למנהל
              המערכת.
            </EmptyDescription>
          </EmptyHeader>
          <p
            className="mt-2 text-center text-body-sm text-muted-foreground"
            dir="ltr"
            role="alert"
          >
            {loadError}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            נסו שוב
          </Button>
        </Empty>
      </div>
    );

  return (
    <div className="mt-8">
      {!isOutOfShidduchimStatus(query.personal_status) && (
        <p className="mb-3 text-body-sm text-muted-foreground">
          כרטיסים של נשואים ושל מי שהתארסו לפני יותר מחודש אינם מוצגים כאן.
          לאיתורם בחרו את הסטטוס בסינון.
        </p>
      )}
      {students.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>מממ... לא מצאנו שמות שמתאימים לחיפוש שלך</EmptyTitle>
            <EmptyDescription>כדאי לשנות חלק מהפרמטרים</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* כרטיסים — מובייל בלבד */}
          <div className="flex flex-col gap-2 md:hidden">
            {students.map((student) => (
              <div
                key={student.id}
                {...rowLinkPropsFor(student)}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  isRecentlyEngaged(student) && ENGAGED_ROW_CLASS,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {student.first_name} {student.last_name}
                      {isRecentlyEngaged(student) && (
                        <span className="text-caption font-medium text-warning-muted-foreground">
                          🎉 מאורס/ת
                        </span>
                      )}
                      {(student.photo_count ?? 0) > 0 && (
                        <Camera
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-label="יש תמונה"
                        />
                      )}
                      {student.cv_url && (
                        <FileText
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-label="יש קובץ קו״ח"
                        />
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground">
                      <span>
                        {parseStatus(student.personal_status, student.gender)}
                      </span>
                      <span>·</span>
                      <span>גיל {calculateAge(student.birth_date || "")}</span>
                      {student.city && (
                        <>
                          <span>·</span>
                          <span>{student.city}</span>
                        </>
                      )}
                      {student.height && (
                        <>
                          <span>·</span>
                          <span>{student.height} ס״מ</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-0.5 flex shrink-0 items-center gap-1">
                    <button
                      onClick={() =>
                        handleFavoriteChange(
                          !favSet.has(student.id),
                          student.id,
                        )
                      }
                      className="p-1 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={
                        !favSet.has(student.id) &&
                        isOutOfShidduchimStatus(student.personal_status)
                      }
                      aria-label={
                        favSet.has(student.id)
                          ? "הסר ממועדפים"
                          : isOutOfShidduchimStatus(student.personal_status)
                            ? "לא ניתן להוסיף מאורס או נשוי למועדפים"
                            : "הוסף למועדפים"
                      }
                    >
                      <Star
                        className={cn(
                          "h-5 w-5 transition-colors",
                          favSet.has(student.id)
                            ? "fill-favorite text-favorite"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                    {isAdmin && (
                      <DeleteStudentButton
                        variant="icon"
                        studentId={student.id}
                        studentName={`${student.first_name} ${student.last_name}`}
                        onDeleted={() => handleStudentDeleted(student.id)}
                      />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {student.cv_url ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <a
                        href={student.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        קובץ קו״ח
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
                    <Link href={studentCardHref(student.id)}>כרטיס מלא</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* טבלה — דסקטופ בלבד */}
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_3fr] md:gap-4">
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
            {students.map((student) => (
              <div
                key={student.id}
                {...rowLinkPropsFor(student)}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  "col-span-full grid grid-cols-subgrid items-center",
                  isRecentlyEngaged(student) && ENGAGED_ROW_CLASS,
                )}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      handleFavoriteChange(!favSet.has(student.id), student.id)
                    }
                    className="p-1 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      !favSet.has(student.id) &&
                      isOutOfShidduchimStatus(student.personal_status)
                    }
                    aria-label={
                      favSet.has(student.id)
                        ? "הסר ממועדפים"
                        : isOutOfShidduchimStatus(student.personal_status)
                          ? "לא ניתן להוסיף מאורס או נשוי למועדפים"
                          : "הוסף למועדפים"
                    }
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors",
                        favSet.has(student.id)
                          ? "fill-favorite text-favorite"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                  {isAdmin && (
                    <DeleteStudentButton
                      variant="icon"
                      studentId={student.id}
                      studentName={`${student.first_name} ${student.last_name}`}
                      onDeleted={() => handleStudentDeleted(student.id)}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {parseStatus(student.personal_status, student.gender)}
                  {(student.photo_count ?? 0) > 0 && (
                    <Camera
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="יש תמונה"
                    />
                  )}
                  {student.cv_url && (
                    <FileText
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="יש קובץ קו״ח"
                    />
                  )}
                </div>
                <div>{student.last_name}</div>
                <div>{student.first_name}</div>
                <div>
                  {student.parents_info?.father?.self?.prefix}{" "}
                  {student.parents_info?.father?.self?.name}
                </div>
                <div>
                  {student.parents_info?.mother?.self?.prefix}{" "}
                  {student.parents_info?.mother?.self?.name}
                </div>
                <div>{student.city}</div>
                <div>{calculateAge(student.birth_date || "")}</div>
                <div>{student.height}</div>
                <div className="flex gap-1">
                  {student.cv_url ? (
                    <Button asChild className="flex-1" variant="outline">
                      <a
                        href={student.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        קובץ קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="flex-1" variant="outline">
                      <Link href={"/" as any}>להוספת קו״ח</Link>
                    </Button>
                  )}
                  <Button asChild className="flex-1">
                    <Link href={studentCardHref(student.id)}>
                      לצפיה בכרטיס המלא
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
