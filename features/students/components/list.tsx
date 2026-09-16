"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudentQuery } from "@/features/students/lib/student-query-context";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { DataTableSkeleton, type DataTableSort } from "@/components/data-table";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  StudentsTable,
  type StudentTableRow,
} from "@/features/students/components/students-table";
import { isOutOfShidduchimStatus } from "@/features/students/lib/student-status";

type Student = StudentTableRow;

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

export default function StudentsList() {
  const [user, setUser] = useState<User | undefined>(undefined);
  const { query } = useStudentQuery();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  // שגיאת טעינה אמיתית — נבדלת מ"אין תוצאות", כדי שכשל שאילתה לא ייראה כמו חיפוש ריק
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // המיון נשמר כאן ולא בטבלה: כל שינוי סינון מציג שלד וטוען מחדש, ובלי
  // זה הטבלה הייתה נבנית מחדש והמיון שבחרו היה מתאפס
  // ברירת המחדל: א-ב לפי שם משפחה. רשימה בלי סדר קבוע נראית אקראית, ובלי
  // limit בשאילתה כל השורות נטענות - ולכן המיון בלקוח הוא על כל התוצאות
  const [sort, setSort] = useState<DataTableSort | null>({
    key: "last-name",
    direction: "asc",
  });

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

  const handleStudentDeleted = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handleCvAdded = (studentId: string, cvUrl: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, cv_url: cvUrl } : s)),
    );
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

  if (loading) return <DataTableSkeleton breakpoint="lg" className="mt-8" />;

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
          <EmptyContent>
            <p
              className="text-body-sm text-muted-foreground"
              dir="ltr"
              role="alert"
            >
              {loadError}
            </p>
            <Button
              variant="outline"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              נסו שוב
            </Button>
          </EmptyContent>
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
      <StudentsTable
        preset="list"
        caption="רשימת המיועדים"
        students={students}
        sort={sort}
        onSortChange={setSort}
        isFavorite={(id) => favSet.has(id)}
        onToggleFavorite={(id, nextIsFavorite) =>
          handleFavoriteChange(nextIsFavorite, id)
        }
        canDelete={isAdmin}
        onDeleted={handleStudentDeleted}
        onCvAdded={handleCvAdded}
        emptyState={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>מממ... לא מצאנו שמות שמתאימים לחיפוש שלך</EmptyTitle>
              <EmptyDescription>כדאי לשנות חלק מהפרמטרים</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
    </div>
  );
}
