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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import calculateAge from "@/lib/calculateAge";
import { FileText, Star } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
  personal_status: "married" | "engaged" | "single" | "divorced" | "widowed";
  last_name: string;
  first_name: string;
  parents_info: {
    father: { self: { prefix: string; name: string; suffix: string } };
    mother: { self: { prefix: string; name: string; suffix: string } };
  };
  city: string;
  birth_date: Date;
  height: number;
  cv_url?: string;
  permalink: string;
};

const STATUS_LABEL: Record<string, string> = {
  single: "רווק",
  married: "נשוי",
  engaged: "מאורס",
  divorced: "גרוש",
  widowed: "אלמן",
};

const STATUS_CLASS: Record<string, string> = {
  single: "border-blue-200 bg-blue-50 text-blue-700",
  married: "border-muted bg-muted text-muted-foreground",
  engaged: "border-emerald-200 bg-emerald-50 text-emerald-700",
  divorced: "border-orange-200 bg-orange-50 text-orange-700",
  widowed: "border-purple-200 bg-purple-50 text-purple-700",
};

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

        if (query.first_name) q = q.ilike("first_name", `%${query.first_name}%`);
        if (query.last_name) q = q.ilike("last_name", `%${query.last_name}%`);
        if (query.gender) q = q.eq("gender", query.gender);
        if (query.personal_status) q = q.eq("personal_status", query.personal_status);
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
            const v = typeof query.is_yeshiva === "boolean" ? query.is_yeshiva : query.is_yeshiva === "true";
            q = q.eq("is_yeshiva", v);
          } catch {}
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
    const nextFavs = checked ? [...currentFavs, id] : currentFavs.filter((f) => f !== id);
    const { data, error } = await supabase.auth.updateUser({ data: { favorites: nextFavs } });
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
    <div className="mt-4">
      {students.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>מממ... לא מצאנו שמות שמתאימים לחיפוש שלך</EmptyTitle>
            <EmptyDescription>כדאי לשנות חלק מהפרמטרים</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* מובייל */}
          <div className="flex flex-col gap-2 md:hidden">
            {students.map((student) => (
              <Box key={student.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
                      <span>{STATUS_LABEL[student.personal_status] ?? student.personal_status}</span>
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
                    <Button variant="outline" size="sm" className="flex-1 text-muted-foreground" disabled>
                      אין קו״ח
                    </Button>
                  )}
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/app/students/${student.id}`}>כרטיס מלא</Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>

          {/* דסקטופ */}
          <div className="hidden md:flex md:flex-col md:gap-2">
            {/* Header */}
            <div className="grid grid-cols-[2rem_7rem_9rem_9rem_10rem_10rem_7rem_4rem_4rem_1fr] items-center gap-x-3 px-4 py-2 text-xs font-medium text-muted-foreground">
              <div>★</div>
              <div>סטטוס</div>
              <div>שם משפחה</div>
              <div>שם פרטי</div>
              <div>שם האב</div>
              <div>שם האם</div>
              <div>עיר</div>
              <div>גיל</div>
              <div>גובה</div>
              <div></div>
            </div>

            {students.map((student) => (
              <Box
                key={student.id}
                className="grid grid-cols-[2rem_7rem_9rem_9rem_10rem_10rem_7rem_4rem_4rem_1fr] items-center gap-x-3 px-4 py-3"
              >
                <button
                  onClick={() => handleFavoriteChange(!favSet.has(student.id), student.id)}
                  aria-label={favSet.has(student.id) ? "הסר ממועדפים" : "הוסף למועדפים"}
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      favSet.has(student.id) ? "fill-favorite text-favorite" : "text-muted-foreground hover:text-favorite",
                    )}
                  />
                </button>

                <div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", STATUS_CLASS[student.personal_status])}
                  >
                    {STATUS_LABEL[student.personal_status] ?? student.personal_status}
                  </Badge>
                </div>

                <div className="font-medium">{student.last_name}</div>
                <div className="font-medium">{student.first_name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {student.parents_info.father.self.prefix} {student.parents_info.father.self.name}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {student.parents_info.mother.self.prefix} {student.parents_info.mother.self.name}
                </div>
                <div className="truncate text-sm text-muted-foreground">{student.city}</div>
                <div className="text-sm">{calculateAge(student.birth_date || "")}</div>
                <div className="text-sm">{student.height}</div>

                <div className="flex gap-1.5">
                  {student.cv_url ? (
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <a href={student.cv_url} target="_blank" rel="noopener noreferrer">
                        כרטיס קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="flex-1 text-muted-foreground">
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
        </>
      )}
    </div>
  );
}
