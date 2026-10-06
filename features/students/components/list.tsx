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
import { StudentsTable } from "@/features/students/components/students-table";
import { StudentsPagination } from "@/features/students/components/students-pagination";
import { isOutOfShidduchimStatus } from "@/features/students/lib/student-status";
import { DEFAULT_STUDENTS_SORT } from "@/features/students/lib/students-list-sort";
import { useStudentsPage } from "@/features/students/lib/use-students-page";
import { cn } from "@/lib/utils";

export default function StudentsList() {
  const [user, setUser] = useState<User | undefined>(undefined);
  const { query } = useStudentQuery();
  // המיון נשמר כאן ולא בטבלה: כל שינוי סינון או עמוד טוען מחדש, ובלי
  // זה הטבלה הייתה נבנית מחדש והמיון שבחרו היה מתאפס.
  // ברירת המחדל: א-ב לפי שם משפחה. המיון נעשה בשאילתה (על כל התוצאות,
  // לא רק על העמוד שמוצג), ושינוי שלו מחזיר לעמוד 1.
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_STUDENTS_SORT);
  const {
    students,
    total,
    status,
    errorMessage,
    page,
    setPage,
    reload,
    removeStudent,
    setStudentCv,
  } = useStudentsPage(query, sort);

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

  const favSet = useMemo(
    () => new Set<string>(user?.user_metadata?.favorites || []),
    [user?.user_metadata?.favorites],
  );

  const isAdmin = hasRole(user, "admin");

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

  if (status === "loading")
    return <DataTableSkeleton breakpoint="lg" className="mt-8" />;

  // כשל בטעינה אינו "אין תוצאות" — מציגים אותו במפורש עם אפשרות לנסות שוב
  if (status === "error")
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
              {errorMessage}
            </p>
            <Button variant="outline" onClick={reload}>
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
      {/* בטעינת עמוד/סינון/מיון השורות נשארות עמומות, כדי שהטבלה לא תקפוץ */}
      <div
        aria-busy={status === "refreshing"}
        className={cn(
          "transition-opacity",
          status === "refreshing" && "pointer-events-none opacity-60",
        )}
      >
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
          onDeleted={removeStudent}
          onCvAdded={setStudentCv}
          isSortedExternally
          emptyState={
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  מממ... לא מצאנו שמות שמתאימים לחיפוש שלך
                </EmptyTitle>
                <EmptyDescription>כדאי לשנות חלק מהפרמטרים</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </div>
      {total > 0 && (
        <StudentsPagination page={page} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}
