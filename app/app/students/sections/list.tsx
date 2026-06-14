"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudentQuery } from "../page";
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
import { Switch } from "@/components/ui/switch";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
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
  permalink: string;
};

function parseStatus(status: string): string {
  if (status === "married") return "נשוי";
  if (status === "engaged") return "מאורס";
  if (status === "single") return "רווק";
  if (status === "divorced") return "גרוש";
  if (status === "widowed") return "אלמן";
  return status;
}

export default function StudentsList() {
  const [user, setUser] = useState<User | undefined>(undefined);
  const { query } = useStudentQuery();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (isMounted) setUser(user || undefined);
    });
    return () => { isMounted = false; };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    async function fetchStudents() {
      setLoading(true);
      try {
        let q = supabase
          .from("students")
          .select("*")
          .or("in_shidduchim.eq.true,in_shidduchim.is.null");

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
        if (error) { setStudents([]); return; }
        setStudents(data || []);
      } catch {
        if (isMounted) setStudents([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStudents();
    return () => { isMounted = false; };
  }, [query, supabase]);

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

    if (error) { toast.error(error.message); return; }
    if (data) setUser(data.user || undefined);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-center">
        <Spinner /> טוען נתונים...
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
              <Box key={student.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
                      <span>{parseStatus(student.personal_status)}</span>
                      <span>·</span>
                      <span>גיל {calculateAge(student.birth_date || "")}</span>
                      {student.city && <><span>·</span><span>{student.city}</span></>}
                      {student.height && <><span>·</span><span>{student.height} ס״מ</span></>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFavoriteChange(!favSet.has(student.id), student.id)}
                    className="mt-0.5 shrink-0 p-1"
                    aria-label={favSet.has(student.id) ? "הסר ממועדפים" : "הוסף למועדפים"}
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors",
                        favSet.has(student.id) ? "fill-favorite text-favorite" : "text-muted-foreground",
                      )}
                    />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  {student.cv_url ? (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={student.cv_url} target="_blank" rel="noopener noreferrer">קו״ח</a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm" className="flex-1">
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
                className="col-span-full grid grid-cols-subgrid items-center p-4"
              >
                <div>
                  <Switch
                    checked={favSet.has(student.id)}
                    onCheckedChange={(e) => handleFavoriteChange(e, student.id)}
                  />
                </div>
                <div>{parseStatus(student.personal_status)}</div>
                <div>{student.last_name}</div>
                <div>{student.first_name}</div>
                <div>
                  {student.parents_info.father.self.prefix}{" "}
                  {student.parents_info.father.self.name}
                </div>
                <div>
                  {student.parents_info.mother.self.prefix}{" "}
                  {student.parents_info.mother.self.name}
                </div>
                <div>{student.city}</div>
                <div>{calculateAge(student.birth_date || "")}</div>
                <div>{student.height}</div>
                <div className="flex gap-1">
                  {student.cv_url ? (
                    <Button asChild className="flex-1" variant="outline">
                      <a href={student.cv_url} target="_blank" rel="noopener noreferrer">
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
