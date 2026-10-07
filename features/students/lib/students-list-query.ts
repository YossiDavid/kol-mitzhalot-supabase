import type { DataTableSort } from "@/components/data-table";
import type { createClient } from "@/lib/supabase/client";
import { buildCommunityFilterExpression } from "@/features/students/lib/community-filter";
import { isOutOfShidduchimStatus } from "@/features/students/lib/student-status";
import type { StudentQuery } from "@/features/students/lib/student-query-context";
import {
  newCardsSince,
  parseNewCardsFilter,
} from "@/features/students/lib/new-card-window";
import { buildStudentsOrder } from "@/features/students/lib/students-list-sort";

/** כמה כרטיסים בעמוד אחד ברשימת המיועדים */
export const STUDENTS_PAGE_SIZE = 50;

/**
 * העמודות שהטבלה קוראת: התצוגה, המיון (שם משפחה/פרטי, אב, אם, עיר, חסידות,
 * גיל, גובה, סטטוס), הכוכב, הקו״ח, אייקון התמונה והדגשת מאורסים. parents_info
 * נשלף כולו כי שם האב והאם יושבים בתוכו. בלי העמודות הכבדות של הכרטיס המלא
 * (family_info, author_info, about...) שכל שורה ברשימה לא קוראת.
 */
const STUDENT_ROW_COLUMNS = [
  "id",
  "gender",
  "personal_status",
  "first_name",
  "last_name",
  "nickname",
  "parents_info",
  "city",
  "community",
  "birth_date",
  "height",
  "cv_url",
  "photo_count",
  "status_changed_at",
  "in_shidduchim",
  // לתג "חדש" ולמיון לפי תאריך הוספה
  "created_at",
];

type SupabaseBrowserClient = ReturnType<typeof createClient>;

function selectStudents(supabase: SupabaseBrowserClient, columns: string) {
  return supabase
    .from("students")
    .select(columns, { count: "exact" })
    .is("deleted_at", null);
}

/** בונה השאילתה אחרי ה-select הדינמי - כל פילטר מחזיר את אותו בונה */
export type StudentsQueryBuilder = ReturnType<typeof selectStudents>;

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

/** העמודות שנשלפות, כולל join פנימי לפי הסינון (עיסוק / מוסד) */
function buildSelectColumns(query: StudentQuery): string {
  // סינון לפי טבלה קשורה דורש join פנימי (!inner) - אחרת השורה חוזרת
  // גם כשאין לה עיסוק/מוסד תואם, רק עם מערך קשור ריק
  const institution = sanitizeTerm(query.institution);
  return [
    ...STUDENT_ROW_COLUMNS,
    // לשורת הילדים של גרוש/אלמן. ללא הרשאה (RLS) המערך חוזר ריק, וזה בסדר
    "previous_partners(children, children_number, no_children)",
    ...(query.employment ? ["employment_history!inner(category)"] : []),
    ...(institution ? ["education_history!inner(name)"] : []),
  ].join(",");
}

/**
 * כרטיסים פעילים, או מאורסים לאחרונה (status_changed_at יכול להיות ריק
 * בשורות ישנות). סינון מפורש למאורס/נשוי מדלג על זה, כדי שהכרטיסים האלה
 * יישארו נגישים.
 */
function applyVisibilityRule(
  q: StudentsQueryBuilder,
  query: StudentQuery,
): StudentsQueryBuilder {
  if (isOutOfShidduchimStatus(query.personal_status)) return q;
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return q.or(
    [
      "in_shidduchim.eq.true",
      "in_shidduchim.is.null",
      `and(personal_status.eq.engaged,status_changed_at.gte.${oneMonthAgo.toISOString()})`,
      "and(personal_status.eq.engaged,status_changed_at.is.null)",
    ].join(","),
  );
}

/**
 * חיפוש חופשי על פני העמודות שמשתמש היה מצפה להקליד בהן, וקהילה.
 * ilike ולא textSearch, כי אין אינדקס full-text והשמות קצרים.
 */
function applyTextSearch(
  q: StudentsQueryBuilder,
  query: StudentQuery,
): StudentsQueryBuilder {
  let next = q;
  const term = sanitizeTerm(query.search);
  if (term) {
    next = next.or(
      [
        `first_name.ilike.%${term}%`,
        `last_name.ilike.%${term}%`,
        `city.ilike.%${term}%`,
        `community.ilike.%${term}%`,
        `shtible.ilike.%${term}%`,
      ].join(","),
    );
  }
  // קהילה: הביטוי מטפל ב-NULL/ריק במפורש ו-or נפרד משתלב ב-AND עם השאר
  const communityExpression = buildCommunityFilterExpression(query.communities);
  return communityExpression ? next.or(communityExpression) : next;
}

function applyFieldFilters(
  q: StudentsQueryBuilder,
  query: StudentQuery,
): StudentsQueryBuilder {
  let next = q;
  if (query.first_name)
    next = next.ilike("first_name", `%${query.first_name}%`);
  if (query.last_name) next = next.ilike("last_name", `%${query.last_name}%`);
  if (query.gender) next = next.eq("gender", query.gender);
  if (query.personal_status)
    next = next.eq("personal_status", query.personal_status);
  if (query.city) next = next.ilike("city", `%${query.city}%`);

  const fatherName = sanitizeTerm(query.father_name);
  if (fatherName) {
    next = next.ilike("parents_info->father->self->>name", `%${fatherName}%`);
  }
  if (query.employment) {
    next = next.eq("employment_history.category", query.employment);
  }
  const institution = sanitizeTerm(query.institution);
  if (institution) {
    next = next.ilike("education_history.name", `%${institution}%`);
  }
  if (query.is_yeshiva === "true" || query.is_yeshiva === "false") {
    next = next.eq("is_yeshiva", query.is_yeshiva === "true");
  }
  const newCards = parseNewCardsFilter(query.newCards);
  if (newCards)
    next = next.gte("created_at", newCardsSince(newCards, new Date()));
  return next;
}

function applyRangeFilters(
  q: StudentsQueryBuilder,
  query: StudentQuery,
): StudentsQueryBuilder {
  let next = q;
  // גיל X ומעלה: נולד עד לפני X שנים. גיל Y לכל היותר: נולד אחרי
  // לפני Y+1 שנים (מי שבן Y ו-11 חודשים עדיין "בן Y").
  const ageMin = parseNonNegativeInt(query.ageMin);
  if (ageMin !== null) next = next.lte("birth_date", yearsAgo(ageMin));
  const ageMax = parseNonNegativeInt(query.ageMax);
  if (ageMax !== null) next = next.gt("birth_date", yearsAgo(ageMax + 1));

  const heightMin = parseNonNegativeInt(query.heightMin);
  if (heightMin !== null) next = next.gte("height", heightMin);
  const heightMax = parseNonNegativeInt(query.heightMax);
  if (heightMax !== null) next = next.lte("height", heightMax);
  return next;
}

function applyOrder(
  q: StudentsQueryBuilder,
  sort: DataTableSort | null,
): StudentsQueryBuilder {
  return buildStudentsOrder(sort).reduce(
    (next, { column, ascending, nullsFirst }) =>
      next.order(column, { ascending, nullsFirst }),
    q,
  );
}

/** טווח השורות (כולל משני הקצוות) של עמוד, לפי מספר עמוד שמתחיל ב-1 */
export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * STUDENTS_PAGE_SIZE;
  return { from, to: from + STUDENTS_PAGE_SIZE - 1 };
}

/** מספר העמודים הכולל; לפחות 1, גם כשאין תוצאות */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
}

/** שאילתת עמוד אחד של רשימת המיועדים: סינון, מיון, וטווח עם ספירה מדויקת */
export function buildStudentsPageQuery(
  supabase: SupabaseBrowserClient,
  query: StudentQuery,
  sort: DataTableSort | null,
  page: number,
): StudentsQueryBuilder {
  const { from, to } = pageRange(page);
  const filtered = applyRangeFilters(
    applyFieldFilters(
      applyTextSearch(
        applyVisibilityRule(
          selectStudents(supabase, buildSelectColumns(query)),
          query,
        ),
        query,
      ),
      query,
    ),
    query,
  );
  return applyOrder(filtered, sort).range(from, to);
}
