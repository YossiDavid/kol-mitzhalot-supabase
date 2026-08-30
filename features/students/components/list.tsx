"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudentQuery } from "@/features/students/lib/student-query-context";
import { createClient } from "@/lib/supabase/client";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import calculateAge from "@/lib/calculateAge";
import { Star, Camera } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

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
  image_url?: string | null;
  status_changed_at?: string | null;
  permalink: string;
};

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

        let q = supabase
          .from("students")
          .select("*")
          // Active cards, or recently engaged (status_changed_at may be null on older rows)
          .or(
            [
              "in_shidduchim.eq.true",
              "in_shidduchim.is.null",
              `and(personal_status.eq.engaged,status_changed_at.gte.${oneMonthAgoStr})`,
              "and(personal_status.eq.engaged,status_changed_at.is.null)",
            ].join(","),
          );

        if (query.first_name)
          q = q.ilike("first_name", `%${query.first_name}%`);
        if (query.last_name) q = q.ilike("last_name", `%${query.last_name}%`);
        if (query.gender) q = q.eq("gender", query.gender);
        if (query.personal_status)
          q = q.eq("personal_status", query.personal_status);
        if (query.city) q = q.ilike("city", `%${query.city}%`);

        if (query.ageMin) {
          const minAge = parseInt(query.ageMin);
          if (!isNaN(minAge)) {
            const maxBirthDate = new Date();
            maxBirthDate.setFullYear(maxBirthDate.getFullYear() - minAge);
            q = q.lte("birth_date", maxBirthDate.toISOString().split("T")[0]);
          }
        }

        if (query.is_yeshiva !== undefined && query.is_yeshiva !== "") {
          try {
            const isYeshivaValue =
              typeof query.is_yeshiva === "boolean"
                ? query.is_yeshiva
                : query.is_yeshiva === "true";
            q = q.eq("is_yeshiva", isYeshivaValue);
          } catch {
            // column may not exist in all schemas
          }
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
        setStudents(data || []);
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

  const handleFavoriteChange = async (checked: boolean, id: string) => {
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
              <Box
                key={student.id}
                className={cn(
                  "p-4",
                  isRecentlyEngaged(student) &&
                    "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {student.first_name} {student.last_name}
                      {isRecentlyEngaged(student) && (
                        <span className="text-caption font-medium text-yellow-700 dark:text-yellow-400">
                          🎉 מאורס/ת
                        </span>
                      )}
                      {student.image_url && (
                        <Camera
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-label="יש תמונה"
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
                  <button
                    onClick={() =>
                      handleFavoriteChange(!favSet.has(student.id), student.id)
                    }
                    className="mt-0.5 shrink-0 p-1"
                    aria-label={
                      favSet.has(student.id) ? "הסר ממועדפים" : "הוסף למועדפים"
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
                        קו״ח
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
                    <Link href={`/app/students/${student.id}`}>כרטיס מלא</Link>
                  </Button>
                </div>
              </Box>
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
              <Box
                key={student.id}
                className={cn(
                  "col-span-full grid grid-cols-subgrid items-center p-4",
                  isRecentlyEngaged(student) &&
                    "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
                )}
              >
                <div>
                  <button
                    onClick={() =>
                      handleFavoriteChange(!favSet.has(student.id), student.id)
                    }
                    className="p-1"
                    aria-label={
                      favSet.has(student.id) ? "הסר ממועדפים" : "הוסף למועדפים"
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
                </div>
                <div className="flex items-center gap-1">
                  {parseStatus(student.personal_status, student.gender)}
                  {student.image_url && (
                    <Camera
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="יש תמונה"
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
                        כרטיס קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="flex-1" variant="outline">
                      <Link href={"/" as any}>להוספת קו״ח</Link>
                    </Button>
                  )}
                  <Button asChild className="flex-1">
                    <Link href={`/app/students/${student.id}`}>
                      לצפיה בכרטיס המלא
                    </Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
