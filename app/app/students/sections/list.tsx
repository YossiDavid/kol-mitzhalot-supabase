"use client";
import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

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

export default function StudentsList() {
  const [user, setUser] = useState<User | undefined>(undefined);
  const { query } = useStudentQuery();
  const [students, setStudents] = useState<Student[]>([]);

  const parseStatus = (status: Student["personal_status"]) => {
    if (status === "married") return "נשוי";
    if (status === "engaged") return "מאורס";
    if (status === "single") return "רווק";
    if (status === "divorced") return "גרוש";
    if (status === "widowed") return "אלמן";
  };
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user || undefined);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      try {
        // true או null (רשומות ישנות לפני תיקון create_full_student_profile) — לא false בלבד
        let q = supabase
          .from("students")
          .select("*")
          .or("in_shidduchim.eq.true,in_shidduchim.is.null");

        // פילוח דינמי לפי כל השדות הקיימים ב-query
        if (query.first_name)
          q = q.ilike("first_name", `%${query.first_name}%`);
        if (query.last_name) q = q.ilike("last_name", `%${query.last_name}%`);
        if (query.gender) q = q.eq("gender", query.gender);
        if (query.personal_status)
          q = q.eq("personal_status", query.personal_status);
        if (query.city) q = q.ilike("city", `%${query.city}%`);

        // Filter by age using birth_date (calculate max birth_date for minimum age)
        if (query.ageMin) {
          const minAge = parseInt(query.ageMin);
          if (!isNaN(minAge)) {
            const maxBirthDate = new Date();
            maxBirthDate.setFullYear(maxBirthDate.getFullYear() - minAge);
            q = q.lte("birth_date", maxBirthDate.toISOString().split("T")[0]);
          }
        }

        // Handle is_yeshiva - convert string to boolean if needed
        // Note: This column might not exist in all database schemas
        if (query.is_yeshiva !== undefined && query.is_yeshiva !== "") {
          try {
            const isYeshivaValue =
              typeof query.is_yeshiva === "boolean"
                ? query.is_yeshiva
                : query.is_yeshiva === "true";
            q = q.eq("is_yeshiva", isYeshivaValue);
          } catch (err) {
            // Column might not exist, skip this filter
          }
        }

        // Note: yeshiva_name might be in education_history table, not students table
        // For now, we'll skip this filter if it causes issues
        // if (query.yeshiva_name)
        //   q = q.ilike("yeshiva_name", `%${query.yeshiva_name}%`);
        // ... תוסיף כאן עוד שדות לפי הצורך

        const { data, error } = await q;

        if (error) {
          // Silently handle error - show empty state
          setStudents([]);
          return;
        }
        setStudents(data || []);
      } catch (err) {
        // Silently handle error - show empty state
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [query, supabase]); // ירוץ בכל פעם שהפילטר משתנה

  const handleFavoriteChange = async (e: boolean, id: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        favorites: e
          ? [...(user?.user_metadata?.favorites || ([] as string[])), id]
          : (user?.user_metadata?.favorites || ([] as string[])).filter(
              (favoriteId: string) => favoriteId !== id,
            ),
      },
    });

    if (data) {
      setUser(data.user || undefined);
      return;
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    setStudents(
      students.map((student) =>
        student.id === id ? { ...student, isFavorite: e } : student,
      ),
    );
    toast.success("המיועד נוסף למועדפים");
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
          <div className="flex flex-col gap-3 md:hidden">
            {students.map((student, index) => (
              <Box key={index} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {student.first_name} {student.last_name}
                  </span>
                  <Switch
                    checked={
                      user?.user_metadata?.favorites?.includes(student.id) ||
                      false
                    }
                    onCheckedChange={(e) => handleFavoriteChange(e, student.id)}
                  />
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span>{parseStatus(student.personal_status)}</span>
                  <span>גיל {calculateAge(student.birth_date || "")}</span>
                  {student.city && <span>{student.city}</span>}
                  {student.height && <span>{student.height} ס״מ</span>}
                </div>
                <div className="flex gap-2">
                  {student.cv_url ? (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={student.cv_url} target="_blank" rel="noopener noreferrer">
                        קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm" className="flex-1 bg-amber-100">
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
            {students.map((student, index) => (
              <Box
                key={index}
                className="col-span-full grid grid-cols-subgrid items-center p-4"
              >
                <div>
                  <Switch
                    checked={
                      user?.user_metadata?.favorites?.includes(student.id) ||
                      false
                    }
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
                    <Button asChild className="flex-1" variant={"outline"}>
                      <a href={student.cv_url} target="_blank" rel="noopener noreferrer">
                        כרטיס קו״ח
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="flex-1 bg-amber-100" variant={"outline"}>
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
